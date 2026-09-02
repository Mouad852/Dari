package ma.dari.api.config;

import com.google.firebase.auth.FirebaseAuth;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class FirebaseWarmup implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(FirebaseWarmup.class);

    private final FirebaseAuth firebaseAuth;

    public FirebaseWarmup(FirebaseAuth firebaseAuth) {
        this.firebaseAuth = firebaseAuth;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            // Intentionally invalid: the point is to force the SDK to fetch Google’s
            // public keys once at startup, not on a user’s first request.
            firebaseAuth.verifyIdToken("warmup");
        } catch (Exception ignored) {
            log.debug("Firebase warmup token rejected as expected; public keys were initialized", ignored);
        }
    }
}
