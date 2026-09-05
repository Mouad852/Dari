package ma.dari.api.common.ratelimit;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitServiceTest {

    @Test
    void rejectsAfterTheConfiguredWindowCapacity() {
        RateLimitService service = new RateLimitService(
                2, Duration.ofHours(1),
                30, Duration.ofMinutes(1),
                5, Duration.ofHours(1),
                20, Duration.ofHours(1),
                5, Duration.ofHours(1));

        assertThat(service.tryAcquire(RateLimitType.REPORT, "user:test").allowed()).isTrue();
        assertThat(service.tryAcquire(RateLimitType.REPORT, "user:test").allowed()).isTrue();

        RateLimitService.Decision rejected = service.tryAcquire(RateLimitType.REPORT, "user:test");
        assertThat(rejected.allowed()).isFalse();
        assertThat(rejected.retryAfterSeconds()).isBetween(1L, 3600L);
    }

    @Test
    void keepsIdentityAndAddressBucketsIndependent() {
        RateLimitService service = new RateLimitService(
                1, Duration.ofHours(1),
                30, Duration.ofMinutes(1),
                5, Duration.ofHours(1),
                20, Duration.ofHours(1),
                5, Duration.ofHours(1));

        assertThat(service.tryAcquire(RateLimitType.REPORT, "user:first").allowed()).isTrue();
        assertThat(service.tryAcquire(RateLimitType.REPORT, "user:second").allowed()).isTrue();
        assertThat(service.tryAcquire(RateLimitType.REPORT, "ip:127.0.0.1").allowed()).isTrue();
    }
}
