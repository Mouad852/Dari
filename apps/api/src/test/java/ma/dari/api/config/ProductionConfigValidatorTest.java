package ma.dari.api.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mock.env.MockEnvironment;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The production fail-fast contract, without booting the production context:
 * FirebaseConfig would need real credentials, and none of these rules need a
 * database. Property names mirror application-production.yml; the placeholder
 * cases prove an unset variable is reported by its environment name.
 */
class ProductionConfigValidatorTest {

    private static final String DB_PASSWORD = "db-password-sentinel";
    private static final String S3_SECRET = "s3-secret-sentinel";
    private static final String SMTP_PASSWORD = "smtp-password-sentinel";

    @TempDir
    Path tempDir;

    private Path credentials;

    @BeforeEach
    void createCredentialsFile() throws IOException {
        credentials = Files.writeString(tempDir.resolve("service-account.json"), "{}");
    }

    /** A complete, valid production configuration, keyed by property name. */
    private Map<String, String> valid() {
        Map<String, String> properties = new LinkedHashMap<>();
        properties.put("spring.datasource.url", "jdbc:postgresql://db.internal:5432/dari");
        properties.put("spring.datasource.username", "dari");
        properties.put("spring.datasource.password", DB_PASSWORD);
        properties.put("dari.web-origins", "https://dari.ma,https://www.dari.ma");
        properties.put("dari.firebase.credentials-path", credentials.toString());
        properties.put("dari.location.fuzz-secret", "test-only-fuzz-secret-with-at-least-thirty-two-characters");
        properties.put("dari.media.provider", "s3");
        properties.put("dari.media.public-base-url", "https://media.dari.ma");
        properties.put("dari.media.s3.endpoint", "https://s3.eu-west-3.amazonaws.com");
        properties.put("dari.media.s3.region", "eu-west-3");
        properties.put("dari.media.s3.bucket", "dari-media");
        properties.put("dari.media.s3.access-key", "access-key-id");
        properties.put("dari.media.s3.secret-key", S3_SECRET);
        properties.put("dari.notifications.enabled", "true");
        properties.put("dari.notifications.from", "no-reply@dari.ma");
        properties.put("spring.mail.host", "smtp.example.net");
        properties.put("spring.mail.port", "587");
        properties.put("spring.mail.username", "apikey");
        properties.put("spring.mail.password", SMTP_PASSWORD);
        return properties;
    }

    private static MockEnvironment environment(Map<String, String> properties) {
        var environment = new MockEnvironment();
        properties.forEach(environment::setProperty);
        return environment;
    }

    private static List<String> problems(Map<String, String> properties) {
        return ProductionConfigValidator.problems(environment(properties));
    }

    @Test
    @DisplayName("A complete production configuration has no problems")
    void completeConfigurationPasses() {
        assertThat(problems(valid())).isEmpty();
    }

    @ParameterizedTest(name = "{0} unset")
    @DisplayName("Every required variable is named when its placeholder cannot be resolved")
    @CsvSource({
            "DB_URL, spring.datasource.url",
            "POSTGRES_USER, spring.datasource.username",
            "POSTGRES_PASSWORD, spring.datasource.password",
            "DARI_WEB_ORIGIN, dari.web-origins",
            "FIREBASE_CREDENTIALS_PATH, dari.firebase.credentials-path",
            "DARI_LOCATION_FUZZ_SECRET, dari.location.fuzz-secret",
            "DARI_MEDIA_PROVIDER, dari.media.provider",
            "DARI_MEDIA_PUBLIC_BASE_URL, dari.media.public-base-url",
            "DARI_MEDIA_S3_ENDPOINT, dari.media.s3.endpoint",
            "DARI_MEDIA_S3_REGION, dari.media.s3.region",
            "DARI_MEDIA_S3_BUCKET, dari.media.s3.bucket",
            "DARI_MEDIA_S3_ACCESS_KEY, dari.media.s3.access-key",
            "DARI_MEDIA_S3_SECRET_KEY, dari.media.s3.secret-key",
            "DARI_NOTIFICATIONS_FROM, dari.notifications.from",
            "SMTP_HOST, spring.mail.host",
            "SMTP_USERNAME, spring.mail.username",
            "SMTP_PASSWORD, spring.mail.password"
    })
    void unresolvedPlaceholderIsNamed(String variable, String property) {
        var properties = valid();
        properties.put(property, "${" + variable + "}");

        assertThat(problems(properties)).containsExactly(variable + " is not set (" + property + ")");
    }

    @Test
    @DisplayName("Blank values count as missing")
    void blankValuesAreMissing() {
        var properties = valid();
        properties.put("dari.media.s3.access-key", "");
        properties.put("dari.media.s3.secret-key", "   ");

        assertThat(problems(properties)).containsExactly(
                "DARI_MEDIA_S3_ACCESS_KEY is not set (dari.media.s3.access-key)",
                "DARI_MEDIA_S3_SECRET_KEY is not set (dari.media.s3.secret-key)");
    }

    @ParameterizedTest(name = "{0}={1}")
    @DisplayName("Unsafe values are rejected with the rule they break")
    @CsvSource(delimiter = '|', value = {
            "DARI_MEDIA_PROVIDER        | dari.media.provider          | local",
            "DARI_NOTIFICATIONS_ENABLED | dari.notifications.enabled   | false",
            "DARI_MEDIA_PUBLIC_BASE_URL | dari.media.public-base-url   | http://media.dari.ma",
            "DARI_MEDIA_PUBLIC_BASE_URL | dari.media.public-base-url   | /uploads",
            "DARI_WEB_ORIGIN            | dari.web-origins             | http://dari.ma",
            "DARI_WEB_ORIGIN            | dari.web-origins             | https://dari.ma/",
            "DARI_WEB_ORIGIN            | dari.web-origins             | https://dari.ma,http://localhost:3000",
            "DARI_WEB_ORIGIN            | dari.web-origins             | https://dari.ma,",
            "DB_URL                     | spring.datasource.url        | jdbc:mysql://db/dari",
            "DB_URL                     | spring.datasource.url        | jdbc:postgresql://",
            "DARI_NOTIFICATIONS_FROM    | dari.notifications.from      | no-reply",
            "DARI_LOCATION_FUZZ_SECRET  | dari.location.fuzz-secret    | too-short",
            "SMTP_PORT                  | spring.mail.port             | smtp",
            "SMTP_PORT                  | spring.mail.port             | 70000",
            "FIREBASE_CREDENTIALS_PATH  | dari.firebase.credentials-path | /run/secrets/does-not-exist.json"
    })
    void unsafeValueIsRejected(String variable, String property, String value) {
        var properties = valid();
        properties.put(property, value);

        List<String> problems = problems(properties);
        assertThat(problems).hasSize(1);
        assertThat(problems.getFirst()).startsWith(variable + " ");
    }

    @Test
    @DisplayName("Values the Spring conditions accept case-insensitively pass here too")
    void conditionValuesAreCaseInsensitive() {
        var properties = valid();
        properties.put("dari.media.provider", "S3");
        properties.put("dari.notifications.enabled", "TRUE");

        assertThat(problems(properties)).isEmpty();
    }

    @Test
    @DisplayName("Every problem is reported in one pass")
    void problemsAreAggregated() {
        var properties = valid();
        properties.put("spring.datasource.url", "${DB_URL}");
        properties.put("dari.location.fuzz-secret", "too-short");
        properties.put("dari.media.provider", "local");
        properties.put("spring.mail.host", "${SMTP_HOST}");

        assertThat(problems(properties)).containsExactly(
                "DB_URL is not set (spring.datasource.url)",
                "DARI_LOCATION_FUZZ_SECRET must be at least 32 characters long",
                "DARI_MEDIA_PROVIDER must be s3 in production",
                "SMTP_HOST is not set (spring.mail.host)");
    }

    // --- wiring ----------------------------------------------------------------

    private static final AtomicBoolean BEAN_CREATED = new AtomicBoolean();

    private ApplicationContextRunner runner(Map<String, String> properties, boolean production) {
        List<String> pairs = new ArrayList<>();
        properties.forEach((key, value) -> pairs.add(key + "=" + value));
        if (production) pairs.add("spring.profiles.active=production");
        BEAN_CREATED.set(false);
        return new ApplicationContextRunner()
                .withInitializer(new ProductionConfigValidator())
                .withPropertyValues(pairs.toArray(String[]::new))
                .withBean("sentinel", Object.class, () -> {
                    BEAN_CREATED.set(true);
                    return new Object();
                });
    }

    @Test
    @DisplayName("Production startup fails before any bean is created, without printing values")
    void productionStartupFailsBeforeBeansExist() {
        var properties = valid();
        properties.put("dari.media.provider", "local");
        properties.put("dari.notifications.enabled", "false");
        properties.put("spring.mail.host", "${SMTP_HOST}");

        runner(properties, true).run(context -> {
            assertThat(context).hasFailed();
            String message = context.getStartupFailure().getMessage();
            assertThat(message)
                    .contains("DARI_MEDIA_PROVIDER", "DARI_NOTIFICATIONS_ENABLED", "SMTP_HOST")
                    .doesNotContain(DB_PASSWORD, S3_SECRET, SMTP_PASSWORD, credentials.toString());
            assertThat(BEAN_CREATED).isFalse();
        });
    }

    @Test
    @DisplayName("A valid production configuration starts")
    void validProductionConfigurationStarts() {
        runner(valid(), true).run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(BEAN_CREATED).isTrue();
        });
    }

    @Test
    @DisplayName("Outside the production profile the validator does nothing")
    void otherProfilesAreNotValidated() {
        var properties = valid();
        properties.put("dari.media.provider", "local");
        properties.put("spring.datasource.url", "${DB_URL}");

        runner(properties, false).run(context -> assertThat(context).hasNotFailed());
    }
}
