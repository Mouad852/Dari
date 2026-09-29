package ma.dari.api.common.error;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
    void protocolMistakesAreClientErrorsInTheStandardEnvelope() {
        var handler = new GlobalExceptionHandler(new SimpleMeterRegistry());

        var wrongVerb = handler.handleMethodNotSupported(
                new HttpRequestMethodNotSupportedException("PUT", List.of("GET", "POST")));
        assertThat(wrongVerb.getStatusCode().value()).isEqualTo(405);
        assertThat(wrongVerb.getHeaders().getAllow()).containsExactlyInAnyOrder(HttpMethod.GET, HttpMethod.POST);
        assertThat(wrongVerb.getBody().code()).isEqualTo("METHOD_NOT_ALLOWED");

        var wrongType = handler.handleMediaTypeNotSupported(new HttpMediaTypeNotSupportedException("text/plain"));
        assertThat(wrongType.getStatusCode().value()).isEqualTo(415);
        assertThat(wrongType.getBody().code()).isEqualTo("UNSUPPORTED_MEDIA_TYPE");

        var missingPart = handler.handleMissingPart(new MissingServletRequestPartException("file"));
        assertThat(missingPart.getStatusCode().value()).isEqualTo(400);
        assertThat(missingPart.getBody()).isEqualTo(new ErrorResponse(
                "VALIDATION_FAILED", "Données invalides", Map.of("file", "Requis")));

        var missingParam = handler.handleMissingParameter(new MissingServletRequestParameterException("city", "String"));
        assertThat(missingParam.getStatusCode().value()).isEqualTo(400);
        assertThat(missingParam.getBody().fields()).containsEntry("city", "Requis");
    }

    @Test
    void aLostConstraintRaceIsAConflictAndIsNotReported() {
        List<ErrorReporter.SafeErrorContext> reported = new ArrayList<>();
        var registry = new SimpleMeterRegistry();
        var handler = new GlobalExceptionHandler(registry, (error, context) -> reported.add(context), "test");
        var violation = new DataIntegrityViolationException("could not execute statement",
                new ConstraintViolationException("duplicate key (email)=(a@example.ma)",
                        new SQLException("duplicate key"), "idx_listing_photos_active_cover"));

        var response = handler.handleConstraintViolation(violation,
                new MockHttpServletRequest("POST", "/api/v1/listings/x/photos"));

        assertThat(response.getStatusCode().value()).isEqualTo(409);
        assertThat(response.getBody()).isEqualTo(new ErrorResponse(
                "CONFLICT", "Conflit avec une autre modification, veuillez réessayer", null));
        assertThat(reported).isEmpty();
        assertThat(registry.find("dari.errors.unhandled").counter()).isNull();
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
