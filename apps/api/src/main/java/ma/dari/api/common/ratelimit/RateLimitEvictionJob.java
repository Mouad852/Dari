package ma.dari.api.common.ratelimit;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Every JVM sweeps its own process-local limiter; this is intentionally not ShedLocked. */
@Component
public class RateLimitEvictionJob {

    private final RateLimitService rateLimits;

    public RateLimitEvictionJob(RateLimitService rateLimits) {
        this.rateLimits = rateLimits;
    }

    @Scheduled(fixedDelayString = "${dari.rate-limits.eviction-interval-ms:300000}")
    public void evictExpiredWindows() {
        rateLimits.evictExpired();
    }
}
