package ma.dari.api.common.error;

import ma.dari.api.support.FakeSentry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class ErrorReportingConfigTest {

    private static final String MISSING = "SENTRY_DSN is not set";
    private static final String INVALID = "SENTRY_DSN is not a valid DSN";

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(ErrorReportingConfig.class)
            .withPropertyValues("dari.release-version=rel-config");

    @Test
    @DisplayName("Production without a DSN: no-op reporter and exactly one warning naming the variable")
    void productionWithoutDsnWarnsOnce(CapturedOutput output) {
        runner.withPropertyValues("spring.profiles.active=production").run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(ErrorReporter.class)).isInstanceOf(NoopErrorReporter.class);
        });
        assertThat(warningsContaining(output, MISSING)).isEqualTo(1);
    }

    @Test
    @DisplayName("Outside production a missing DSN is silent")
    void developmentWithoutDsnIsSilent(CapturedOutput output) {
        runner.run(context ->
                assertThat(context.getBean(ErrorReporter.class)).isInstanceOf(NoopErrorReporter.class));
        assertThat(output.getAll()).doesNotContain(MISSING);
    }

    @Test
    @DisplayName("An unparseable DSN does not stop startup and is not printed")
    void invalidDsnFallsBackWithoutPrintingIt(CapturedOutput output) {
        runner.withPropertyValues("spring.profiles.active=production",
                        "dari.error-reporting.sentry-dsn=not-a-dsn-sentinel-value")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(ErrorReporter.class)).isInstanceOf(NoopErrorReporter.class);
                });
        assertThat(warningsContaining(output, INVALID)).isEqualTo(1);
        assertThat(output.getAll()).doesNotContain("not-a-dsn-sentinel-value");
    }

    @Test
    @DisplayName("A DSN selects the Sentry reporter, closed with the context")
    void dsnSelectsSentry() {
        try (FakeSentry sentry = new FakeSentry()) {
            runner.withPropertyValues("dari.error-reporting.sentry-dsn=" + sentry.dsn())
                    .run(context -> assertThat(context.getBean(ErrorReporter.class))
                            .isInstanceOf(SentryErrorReporter.class));
        }
    }

    private static long warningsContaining(CapturedOutput output, String text) {
        return Arrays.stream(output.getAll().split("\\R"))
                .filter(line -> line.contains(text) && line.contains("WARN"))
                .count();
    }
}
