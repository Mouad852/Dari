package ma.dari.api.support;

import ma.dari.api.media.ImageStore;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.time.Instant;

/**
 * Base for integration tests that drive scheduled jobs themselves.
 *
 * <p>The media cleanup worker runs once at startup and then only when a test
 * calls it; the nightly expiry cron is disabled. Otherwise a test asserting
 * that a row is still PENDING can lose a race with the real scheduler. The
 * application Clock is a {@link MutableClock}, reset to the real time before
 * each test. Every subclass shares this one extra application context.
 */
@TestPropertySource(properties = {
        "dari.media.cleanup-interval-ms=3600000",
        "dari.listing.expiry-cron=-"
})
@Import(MutableClock.Config.class)
public abstract class AbstractJobIntegrationTest extends AbstractIntegrationTest {

    /** The real store (local, or S3 where a subclass configures it), stubbable per test. */
    @MockitoSpyBean
    protected ImageStore imageStore;

    @Autowired
    protected MutableClock clock;

    @BeforeEach
    void resetClock() {
        clock.set(Instant.now());
    }
}
