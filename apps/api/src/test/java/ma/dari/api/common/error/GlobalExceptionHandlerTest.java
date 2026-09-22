package ma.dari.api.common.error;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.ArrayList;
import java.util.List;

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

    @Test
    void anUnhandledErrorIsReportedWithTheConfiguredReleaseVersion() {
        List<ErrorReporter.SafeErrorContext> reported = new ArrayList<>();
        var handler = new GlobalExceptionHandler(new SimpleMeterRegistry(),
                (error, context) -> reported.add(context), "0f3c2a9");

        var response = handler.handleUnexpected(new IllegalStateException("boom"),
                new MockHttpServletRequest("GET", "/api/v1/listings"));

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(reported).singleElement()
                .extracting(ErrorReporter.SafeErrorContext::releaseVersion)
                .isEqualTo("0f3c2a9");
    }
}
