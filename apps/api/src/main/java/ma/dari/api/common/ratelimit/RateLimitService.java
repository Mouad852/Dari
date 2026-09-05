package ma.dari.api.common.ratelimit;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fixed-window limiter for the single API instance.
 *
 * <p>Each write is limited both by authenticated Firebase identity and source
 * address. This protects a real account from a shared-IP burst and makes
 * creating many Firebase identities from one address expensive. A distributed
 * store can replace this service when the API is scaled horizontally.
 */
@Service
public class RateLimitService {

    private final Map<RateLimitType, Policy> policies;
    private final ConcurrentHashMap<BucketKey, Window> windows = new ConcurrentHashMap<>();

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
            @Value("${dari.rate-limits.signup.window:PT1H}") Duration signupWindow) {
        policies = new EnumMap<>(RateLimitType.class);
        policies.put(RateLimitType.REPORT, new Policy(reportMax, reportWindow));
        policies.put(RateLimitType.MESSAGE, new Policy(messageMax, messageWindow));
        policies.put(RateLimitType.LISTING, new Policy(listingMax, listingWindow));
        policies.put(RateLimitType.UPLOAD, new Policy(uploadMax, uploadWindow));
        policies.put(RateLimitType.SIGNUP, new Policy(signupMax, signupWindow));
    }

    public Decision tryAcquire(RateLimitType type, String dimension) {
        Policy policy = policies.get(type);
        if (policy == null || dimension == null || dimension.isBlank()) {
            throw new IllegalArgumentException("Rate-limit policy and dimension are required");
        }

        long now = System.nanoTime();
        Window window = windows.computeIfAbsent(new BucketKey(type, dimension),
                ignored -> new Window(now));
        synchronized (window) {
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
