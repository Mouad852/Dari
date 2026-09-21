package ma.dari.api.config;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Refuses to start the {@code production} profile with a missing or unsafe
 * configuration, and names every problem at once.
 *
 * <p>An initializer rather than a bean, on purpose. It runs before the context
 * refreshes, so before configuration classes are parsed: an unset
 * {@code SMTP_HOST} would otherwise surface first as a placeholder error inside
 * mail auto-configuration's condition, naming one variable, and a missing S3 key
 * would not surface at all until the first upload returned 503. Registered in
 * {@code META-INF/spring.factories}.
 *
 * <p>Messages carry the environment variable name and the rule it broke, never
 * the value. {@code infra/scripts/validate-production-config.ps1} and
 * {@code .sh} check the same names with the same rules, so an operator can run
 * the check on the host before the release starts.
 */
public class ProductionConfigValidator
        implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    static final String PROFILE = "production";

    @Override
    public void initialize(ConfigurableApplicationContext context) {
        Environment environment = context.getEnvironment();
        if (!environment.acceptsProfiles(Profiles.of(PROFILE))) return;

        List<String> problems = problems(environment);
        if (!problems.isEmpty()) {
            throw new InvalidProductionConfigurationException(problems);
        }
    }

    /** Every rule, evaluated in full, so one failed deploy reports everything. */
    static List<String> problems(Environment environment) {
        var check = new Checks(environment);

        String dbUrl = check.required("DB_URL", "spring.datasource.url");
        if (dbUrl != null && !hasTextAfter(dbUrl, "jdbc:postgresql://")) {
            check.invalid("DB_URL", "must be a jdbc:postgresql:// URL with a host");
        }
        check.required("POSTGRES_USER", "spring.datasource.username");
        check.required("POSTGRES_PASSWORD", "spring.datasource.password");

        String origins = check.required("DARI_WEB_ORIGIN", "dari.web-origins");
        if (origins != null && !allHttpsOrigins(origins)) {
            check.invalid("DARI_WEB_ORIGIN",
                    "must be a comma-separated list of https origins with no path or trailing slash");
        }

        String credentials = check.required("FIREBASE_CREDENTIALS_PATH", "dari.firebase.credentials-path");
        if (credentials != null && !readableFile(credentials)) {
            check.invalid("FIREBASE_CREDENTIALS_PATH", "must point to a readable file");
        }

        String fuzzSecret = check.required("DARI_LOCATION_FUZZ_SECRET", "dari.location.fuzz-secret");
        if (fuzzSecret != null && fuzzSecret.trim().length() < 32) {
            check.invalid("DARI_LOCATION_FUZZ_SECRET", "must be at least 32 characters long");
        }

        check.required("DARI_TRUSTED_PROXY_IPS", "server.tomcat.remoteip.internal-proxies");

        String provider = check.required("DARI_MEDIA_PROVIDER", "dari.media.provider");
        if (provider != null && !provider.trim().equalsIgnoreCase("s3")) {
            check.invalid("DARI_MEDIA_PROVIDER", "must be s3 in production");
        }
        String publicBaseUrl = check.required("DARI_MEDIA_PUBLIC_BASE_URL", "dari.media.public-base-url");
        if (publicBaseUrl != null && !isHttpsUrl(publicBaseUrl)) {
            check.invalid("DARI_MEDIA_PUBLIC_BASE_URL", "must be an https URL");
        }
        check.required("DARI_MEDIA_S3_ENDPOINT", "dari.media.s3.endpoint");
        check.required("DARI_MEDIA_S3_REGION", "dari.media.s3.region");
        check.required("DARI_MEDIA_S3_BUCKET", "dari.media.s3.bucket");
        check.required("DARI_MEDIA_S3_ACCESS_KEY", "dari.media.s3.access-key");
        check.required("DARI_MEDIA_S3_SECRET_KEY", "dari.media.s3.secret-key");

        String enabled = check.required("DARI_NOTIFICATIONS_ENABLED", "dari.notifications.enabled");
        if (enabled != null && !enabled.trim().equalsIgnoreCase("true")) {
            check.invalid("DARI_NOTIFICATIONS_ENABLED",
                    "must not be false in production; notifications are the only channel to users");
        }
        String from = check.required("DARI_NOTIFICATIONS_FROM", "dari.notifications.from");
        if (from != null && !from.contains("@")) {
            check.invalid("DARI_NOTIFICATIONS_FROM", "must be an email address");
        }
        check.required("SMTP_HOST", "spring.mail.host");
        String port = check.required("SMTP_PORT", "spring.mail.port");
        if (port != null && !isPort(port)) {
            check.invalid("SMTP_PORT", "must be a port number between 1 and 65535");
        }
        check.required("SMTP_USERNAME", "spring.mail.username");
        check.required("SMTP_PASSWORD", "spring.mail.password");

        return check.problems;
    }

    private static boolean hasTextAfter(String value, String prefix) {
        return value.startsWith(prefix) && value.length() > prefix.length()
                && value.charAt(prefix.length()) != '/';
    }

    private static boolean allHttpsOrigins(String origins) {
        for (String origin : origins.split(",", -1)) {
            String trimmed = origin.trim();
            // An Origin header never has a path, so "https://dari.ma/" would
            // never match a browser request and CORS would fail closed.
            if (!hasTextAfter(trimmed, "https://")) return false;
            String authority = trimmed.substring("https://".length());
            if (authority.contains("/") || authority.contains("?") || authority.contains("#")) return false;
        }
        return true;
    }

    private static boolean isHttpsUrl(String value) {
        try {
            URI uri = URI.create(value.trim());
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null;
        } catch (IllegalArgumentException malformed) {
            return false;
        }
    }

    private static boolean readableFile(String location) {
        try {
            Path path = Path.of(location.trim());
            return Files.isRegularFile(path) && Files.isReadable(path);
        } catch (InvalidPathException malformed) {
            return false;
        }
    }

    private static boolean isPort(String value) {
        try {
            int port = Integer.parseInt(value.trim());
            return port >= 1 && port <= 65535;
        } catch (NumberFormatException notANumber) {
            return false;
        }
    }

    /** Collects problems keyed by the environment variable an operator sets. */
    private static final class Checks {
        private final Environment environment;
        private final List<String> problems = new ArrayList<>();

        private Checks(Environment environment) {
            this.environment = environment;
        }

        /**
         * The resolved property, or null after recording a problem. An
         * unresolvable placeholder ({@code ${DB_URL}} with no DB_URL set) and a
         * blank value are both reported as "is not set".
         */
        String required(String variable, String property) {
            String value;
            try {
                value = environment.getProperty(property);
            } catch (IllegalArgumentException unresolvedPlaceholder) {
                value = null;
            }
            if (value == null || value.isBlank()) {
                problems.add(variable + " is not set (" + property + ")");
                return null;
            }
            return value;
        }

        void invalid(String variable, String rule) {
            problems.add(variable + " " + rule);
        }
    }

    /** Carries only variable names and rules; safe to log in full. */
    static final class InvalidProductionConfigurationException extends IllegalStateException {
        InvalidProductionConfigurationException(List<String> problems) {
            super("Production configuration is invalid (" + problems.size() + " problem"
                    + (problems.size() == 1 ? "" : "s") + "). Values are not shown."
                    + System.lineSeparator() + " - "
                    + String.join(System.lineSeparator() + " - ", problems));
        }
    }
}
