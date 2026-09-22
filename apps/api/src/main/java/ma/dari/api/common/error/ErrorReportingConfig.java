package ma.dari.api.common.error;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

/**
 * Chooses the error reporter once, at startup.
 *
 * <p>The DSN is optional: without one, unhandled errors are logged and counted
 * ({@code dari.errors.unhandled}) and go nowhere else. A production start
 * without one says so once, naming the variable, rather than failing: missing
 * error tracking is an operational gap, not a reason to refuse traffic. A DSN
 * that cannot be parsed is treated the same way, for the same reason. Neither
 * message includes the value.
 */
@Configuration(proxyBeanMethods = false)
class ErrorReportingConfig {

    private static final Logger log = LoggerFactory.getLogger(ErrorReportingConfig.class);

    static final String DSN_VARIABLE = "SENTRY_DSN";

    @Bean
    ErrorReporter errorReporter(@Value("${dari.error-reporting.sentry-dsn:}") String dsn,
                                @Value("${dari.error-reporting.environment:development}") String environment,
                                @Value("${dari.release-version}") String releaseVersion,
                                Environment spring) {
        boolean production = spring.acceptsProfiles(Profiles.of("production"));
        if (dsn == null || dsn.isBlank()) {
            if (production) {
                log.warn("{} is not set: unhandled errors are logged but not sent to error tracking",
                        DSN_VARIABLE);
            }
            return new NoopErrorReporter();
        }
        try {
            SentryErrorReporter reporter = SentryErrorReporter.create(dsn.trim(), environment, releaseVersion);
            log.info("Unhandled errors are reported to error tracking (environment {}, release {})",
                    environment, releaseVersion);
            return reporter;
        } catch (IllegalArgumentException invalid) {
            log.warn("{} is not a valid DSN: unhandled errors are logged but not sent to error tracking",
                    DSN_VARIABLE);
            return new NoopErrorReporter();
        }
    }
}
