package ma.dari.api.common.error;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    @Test
    void rateLimitUsesTheStandard429EnvelopeAndRetryAfterHeader() {
        var response = new GlobalExceptionHandler(new SimpleMeterRegistry()).handle(new RateLimitExceededException(42));

        assertThat(response.getStatusCode().value()).isEqualTo(429);
        assertThat(response.getHeaders().getFirst("Retry-After")).isEqualTo("42");
        assertThat(response.getBody()).isEqualTo(new ErrorResponse(
                "RATE_LIMITED", "Trop de demandes, veuillez réessayer plus tard", null));
    }
}
