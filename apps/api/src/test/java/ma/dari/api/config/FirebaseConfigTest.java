package ma.dari.api.config;

import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseOptions;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.io.ClassPathResource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FirebaseConfig is excluded from the test profile, so its timeouts are checked
 * here without a service account and without contacting Google.
 */
class FirebaseConfigTest {

    @Test
    void optionsCarryTheConfiguredTimeouts() {
        FirebaseOptions options = FirebaseConfig.options(
                GoogleCredentials.create(new AccessToken("unused", null)), 1234, 5678);

        assertThat(options.getConnectTimeout()).isEqualTo(1234);
        assertThat(options.getReadTimeout()).isEqualTo(5678);
    }

    @Test
    void theDefaultsAreBoundedRatherThanTheSdksInfiniteZero() throws Exception {
        var yaml = new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yml")).get(0);

        assertThat(yaml.getProperty("dari.firebase.connect-timeout-ms").toString())
                .isEqualTo("${DARI_FIREBASE_CONNECT_TIMEOUT_MS:5000}");
        assertThat(yaml.getProperty("dari.firebase.read-timeout-ms").toString())
                .isEqualTo("${DARI_FIREBASE_READ_TIMEOUT_MS:10000}");
    }
}
