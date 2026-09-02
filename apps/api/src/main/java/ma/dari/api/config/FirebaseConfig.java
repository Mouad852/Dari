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
    FirebaseApp firebaseApp(@Value("${dari.firebase.credentials-path}") String credentialsPath)
            throws IOException {

        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }
        try (InputStream in = new FileInputStream(credentialsPath)) {
            return FirebaseApp.initializeApp(FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(in))
                    .build());
        }
    }

    @Bean
    FirebaseAuth firebaseAuth(FirebaseApp app) {
        return FirebaseAuth.getInstance(app);
    }
}
