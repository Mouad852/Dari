package ma.dari.api.common.ratelimit;

import io.micrometer.core.instrument.FunctionCounter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;
import java.util.function.LongSupplier;

/**
 * Fixed-window limiter for the single API instance.
 *
 * <p>Each write is limited both by authenticated Firebase identity and source
 * address. This protects a real account from a shared-IP burst and makes
 * creating many Firebase identities from one address expensive. A distributed
 * store can replace this service when the API is scaled horizontally. Expired
 * windows are swept locally so this process-owned map remains bounded.
 */
@Service
public class RateLimitService {

    private static final long CAPACITY_SWEEP_INTERVAL_NANOS = Duration.ofSeconds(1).toNanos();

    private final Map<RateLimitType, Policy> policies;
    private final ConcurrentHashMap<BucketKey, Window> windows = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<RateLimitType, Window> overflowWindows = new ConcurrentHashMap<>();
    private final Object allocationLock = new Object();
    private final LongAdder trackedKeyCapHits = new LongAdder();
    private final LongSupplier monotonicNanos;
    private final int maxTrackedKeys;
    private boolean capacitySweepPerformed;
    private long lastCapacitySweepNanos;
    private long capacitySweepCount;

    @Autowired
    public RateLimitService(
            @Value("${dari.rate-limits.report.max:5}") int reportMax,
            @Value("${dari.rate-limits.report.window:PT1H}") Duration reportWindow,
            @Value("${dari.rate-limits.message.max:30}") int messageMax,
            @Value("${dari.rate-limits.message.window:PT1M}") Duration messageWindow,
            @Value("${dari.rate-limits.listing.max:5}") int listingMax,
            @Value("${dari.rate-limits.listing.window:PT1H}") Duration listingWindow,
            @Value("${dari.rate-limits.upload.max:20}") int uploadMax,
            @Value("${dari.rate-limits.upload.window:PT1H}") Duration uploadWindow,
            @Value("${dari.rate-limits.signup.max:5}") int signupMax,
            @Value("${dari.rate-limits.signup.window:PT1H}") Duration signupWindow,
            @Value("${dari.rate-limits.search.max:120}") int searchMax,
            @Value("${dari.rate-limits.search.window:PT1M}") Duration searchWindow,
            @Value("${dari.rate-limits.max-tracked-keys:100000}") int maxTrackedKeys,
            MeterRegistry meterRegistry) {
        this(reportMax, reportWindow, messageMax, messageWindow, listingMax, listingWindow,
                uploadMax, uploadWindow, signupMax, signupWindow, searchMax, searchWindow,
                maxTrackedKeys, System::nanoTime);
        FunctionCounter.builder("dari.rate_limits.tracked_key_cap_hits", trackedKeyCapHits, LongAdder::sum)
                .description("Rate-limit requests assigned to the shared overflow bucket")
                .register(meterRegistry);
    }

    RateLimitService(int reportMax, Duration reportWindow, int messageMax, Duration messageWindow,
                     int listingMax, Duration listingWindow, int uploadMax, Duration uploadWindow,
                     int signupMax, Duration signupWindow, int searchMax, Duration searchWindow,
                     int maxTrackedKeys, LongSupplier monotonicNanos) {
        policies = new EnumMap<>(RateLimitType.class);
        policies.put(RateLimitType.REPORT, new Policy(reportMax, reportWindow));
        policies.put(RateLimitType.MESSAGE, new Policy(messageMax, messageWindow));
        policies.put(RateLimitType.LISTING, new Policy(listingMax, listingWindow));
        policies.put(RateLimitType.UPLOAD, new Policy(uploadMax, uploadWindow));
        policies.put(RateLimitType.SIGNUP, new Policy(signupMax, signupWindow));
        policies.put(RateLimitType.SEARCH, new Policy(searchMax, searchWindow));
        this.monotonicNanos = monotonicNanos;
        if (maxTrackedKeys < 1) {
            throw new IllegalArgumentException("Rate-limit max tracked keys must be positive");
        }
        this.maxTrackedKeys = maxTrackedKeys;
    }

    RateLimitService(int reportMax, Duration reportWindow, int messageMax, Duration messageWindow,
                     int listingMax, Duration listingWindow, int uploadMax, Duration uploadWindow,
                     int signupMax, Duration signupWindow, int searchMax, Duration searchWindow,
                     LongSupplier monotonicNanos) {
        this(reportMax, reportWindow, messageMax, messageWindow, listingMax, listingWindow,
                uploadMax, uploadWindow, signupMax, signupWindow, searchMax, searchWindow,
                100_000, monotonicNanos);
    }

    RateLimitService(int reportMax, Duration reportWindow, int messageMax, Duration messageWindow,
                     int listingMax, Duration listingWindow, int uploadMax, Duration uploadWindow,
                     int signupMax, Duration signupWindow, int searchMax, Duration searchWindow) {
        this(reportMax, reportWindow, messageMax, messageWindow, listingMax, listingWindow,
                uploadMax, uploadWindow, signupMax, signupWindow, searchMax, searchWindow,
                100_000, System::nanoTime);
    }

    public Decision tryAcquire(RateLimitType type, String dimension) {
        Policy policy = policies.get(type);
        if (policy == null || dimension == null || dimension.isBlank()) {
            throw new IllegalArgumentException("Rate-limit policy and dimension are required");
        }

        long now = monotonicNanos.getAsLong();
        synchronized (allocationLock) {
            Window window = findOrAllocateWindow(type, dimension, now);
            if (now - window.startedAtNanos >= policy.window().toNanos()) {
                window.startedAtNanos = now;
                window.count = 0;
            }
            if (window.count >= policy.max()) {
                long remainingNanos = policy.window().toNanos() - (now - window.startedAtNanos);
                long retryAfterSeconds = Math.max(1, (remainingNanos + 999_999_999L) / 1_000_000_000L);
                return new Decision(false, retryAfterSeconds);
            }
            window.count++;
            return new Decision(true, 0);
        }
    }

    /** Removes windows which cannot be active under any configured policy. */
    public int evictExpired() {
        synchronized (allocationLock) {
            return evictExpired(monotonicNanos.getAsLong());
        }
    }

    private int evictExpired(long now) {
        int removed = 0;
        for (Map.Entry<BucketKey, Window> entry : windows.entrySet()) {
            Window window = entry.getValue();
            Policy policy = policies.get(entry.getKey().type());
            if (now - window.startedAtNanos >= policy.window().toNanos()
                    && windows.remove(entry.getKey(), window)) {
                removed++;
            }
        }
        return removed;
    }

    int windowCount() {
        return windows.size();
    }

    long trackedKeyCapHitCount() {
        return trackedKeyCapHits.sum();
    }

    long capacitySweepCount() {
        return capacitySweepCount;
    }

    /** Must run with {@link #allocationLock} held. */
    private Window findOrAllocateWindow(RateLimitType type, String dimension, long now) {
        BucketKey key = new BucketKey(type, dimension);
        Window existing = windows.get(key);
        if (existing != null) return existing;

        synchronized (allocationLock) {
            existing = windows.get(key);
            if (existing != null) return existing;

            // A scheduled sweep may be up to five minutes away. Avoid a full
            // map scan for every novel source, but reclaim expired windows
            // before declaring the bounded store full.
            if (windows.size() >= maxTrackedKeys && shouldSweepAtCapacity(now)) {
                evictExpired(now);
                capacitySweepPerformed = true;
                lastCapacitySweepNanos = now;
                capacitySweepCount++;
            }
            if (windows.size() < maxTrackedKeys) {
                Window allocated = new Window(now);
                windows.put(key, allocated);
                return allocated;
            }

            trackedKeyCapHits.increment();
            return overflowWindows.computeIfAbsent(type, ignored -> new Window(now));
        }
    }

    /** Must run with {@link #allocationLock} held. */
    private boolean shouldSweepAtCapacity(long now) {
        return !capacitySweepPerformed || now - lastCapacitySweepNanos >= CAPACITY_SWEEP_INTERVAL_NANOS;
    }

    public record Decision(boolean allowed, long retryAfterSeconds) {
    }

    private record Policy(int max, Duration window) {
        private Policy {
            if (max < 1 || window.isZero() || window.isNegative()) {
                throw new IllegalArgumentException("Rate-limit policy must be positive");
            }
        }
    }

    private record BucketKey(RateLimitType type, String dimension) {
    }

    private static final class Window {
        private long startedAtNanos;
        private int count;

        private Window(long startedAtNanos) {
            this.startedAtNanos = startedAtNanos;
        }
    }
}
