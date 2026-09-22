package ma.dari.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Puts the running release on {@code /actuator/info}, which is public, so an
 * operator can see which image is serving without a token or a shell. The same
 * value tags every error report, so a report and a running task can be matched.
 */
@Component
class ReleaseInfoContributor implements InfoContributor {

    private final String releaseVersion;

    ReleaseInfoContributor(@Value("${dari.release-version}") String releaseVersion) {
        this.releaseVersion = releaseVersion;
    }

    @Override
    public void contribute(Info.Builder builder) {
        builder.withDetail("release", Map.of("version", releaseVersion));
    }
}
