package ma.dari.api.common.error;

import io.sentry.Breadcrumb;
import io.sentry.Hint;
import io.sentry.ISentryClient;
import io.sentry.SentryEvent;
import io.sentry.protocol.Message;
import io.sentry.protocol.Request;
import io.sentry.protocol.User;
import ma.dari.api.support.FakeSentry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;

class SentryErrorReporterTest {

    private static final ErrorReporter.SafeErrorContext CONTEXT =
            new ErrorReporter.SafeErrorContext("/api/v1/listings/{id}", "GET", "corr-unit", "rel-unit");

    @Test
    @DisplayName("A client that throws never escapes report()")
    void reportNeverThrows() {
        ISentryClient broken = Mockito.mock(ISentryClient.class);
        Mockito.when(broken.captureEvent(any(SentryEvent.class), any(Hint.class)))
                .thenThrow(new IllegalStateException("SDK exploded"));
        Mockito.when(broken.captureEvent(any(SentryEvent.class), Mockito.<Hint>isNull()))
                .thenThrow(new IllegalStateException("SDK exploded"));

        assertThatCode(() -> new SentryErrorReporter(broken).report(new RuntimeException("boom"), CONTEXT))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("report() returns at once while the endpoint stalls, and close() is bounded")
    void stalledEndpointDoesNotBlockTheCaller() {
        try (FakeSentry sentry = new FakeSentry()) {
            sentry.mode(FakeSentry.Mode.STALL);
            SentryErrorReporter reporter = SentryErrorReporter.create(sentry.dsn(), "unit", "rel-unit");

            long started = System.nanoTime();
            for (int i = 0; i < 100; i++) reporter.report(new RuntimeException("boom " + i), CONTEXT);
            long reporting = Duration.ofNanos(System.nanoTime() - started).toMillis();

            long closing = System.nanoTime();
            reporter.close();
            long closed = Duration.ofNanos(System.nanoTime() - closing).toMillis();

            // 100 captures would take minutes if any waited on the 2 s read timeout.
            assertThat(reporting).as("100 reports, ms").isLessThan(2_000);
            assertThat(closed).as("close, ms").isLessThan(10_000);
        }
    }

    @Test
    @DisplayName("The scrubber keeps only the allow-listed fields")
    void scrubKeepsOnlyTheAllowList() {
        SentryEvent event = new SentryEvent(new IllegalStateException("leaked amina@example.com"));
        Request request = new Request();
        request.setUrl("https://api.dari.ma/api/v1/users/me?email=amina@example.com");
        request.setHeaders(Map.of("Authorization", "Bearer secret"));
        request.setCookies("session=secret");
        event.setRequest(request);
        User user = new User();
        user.setEmail("amina@example.com");
        event.setUser(user);
        event.setBreadcrumbs(List.of(new Breadcrumb("GET /users/me?email=amina@example.com")));
        event.setExtra("body", "Salut");
        Message message = new Message();
        message.setFormatted("leaked amina@example.com");
        event.setMessage(message);
        event.setServerName("ip-10-0-10-23.eu-west-3.compute.internal");
        event.setTag("route", "/api/v1/users/me");
        event.setTag("user_email", "amina@example.com");

        SentryEvent scrubbed = SentryErrorReporter.scrub(event, new Hint());

        assertThat(scrubbed.getRequest()).isNull();
        assertThat(scrubbed.getUser()).isNull();
        assertThat(scrubbed.getBreadcrumbs()).isNullOrEmpty();
        assertThat(scrubbed.getExtras()).isNullOrEmpty();
        assertThat(scrubbed.getMessage()).isNull();
        assertThat(scrubbed.getServerName()).isNull();
        assertThat(scrubbed.getTags()).containsOnlyKeys("route");
    }
}
