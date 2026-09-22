package ma.dari.api.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Firebase Admin, used for exactly two things: verifying ID tokens, and deleting
 * an identity when an account is deleted (phase 09).
 *
 * <p>Excluded from the {@code test} profile — integration tests stub
 * {@link FirebaseAuth} rather than reaching Google, so the suite stays offline
 * and deterministic.
 */
@Configuration
@Profile("!test")
public class FirebaseConfig {

    @Bean
    FirebaseApp firebaseApp(@Value("${dari.firebase.credentials-path}") String credentialsPath,
                            @Value("${dari.firebase.connect-timeout-ms:5000}") int connectTimeoutMs,
                            @Value("${dari.firebase.read-timeout-ms:10000}") int readTimeoutMs)
            throws IOException {

        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }
        try (InputStream in = new FileInputStream(credentialsPath)) {
            return FirebaseApp.initializeApp(
                    options(GoogleCredentials.fromStream(in), connectTimeoutMs, readTimeoutMs));
        }
    }

    /**
     * The SDK defaults both timeouts to 0, meaning none. Bounding them matters
     * most for {@code deleteUser}, which runs inside the account-deletion
     * transaction. The SDK does not retry I/O errors, so a hung call costs at
     * most connect + read; it does retry HTTP 503 up to four times with a
     * 0.5/1/2/4 s backoff, which multiplies that bound.
     *
     * <p>Separate from the bean so the options can be checked without a real
     * service account.
     */
    static FirebaseOptions options(GoogleCredentials credentials, int connectTimeoutMs, int readTimeoutMs) {
        return FirebaseOptions.builder()
                .setCredentials(credentials)
                .setConnectTimeout(connectTimeoutMs)
                .setReadTimeout(readTimeoutMs)
                .build();
    }

    @Bean
    FirebaseAuth firebaseAuth(FirebaseApp app) {
        return FirebaseAuth.getInstance(app);
    }
}
