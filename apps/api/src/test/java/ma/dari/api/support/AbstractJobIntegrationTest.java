package ma.dari.api.support;

import ma.dari.api.media.ImageStore;
import ma.dari.api.media.MediaCleanupService;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.time.Instant;

/**
 * Base for integration tests that drive scheduled jobs themselves (the test
 * profile keeps every scheduler from firing on its own; see
 * application-test.yml).
 *
 * <p>The application Clock is a {@link MutableClock}, reset to the real time
 * before each test, and the image store is a spy that a test can make fail or
 * stall. Every subclass shares this one extra application context.
 */
@Import(MutableClock.Config.class)
public abstract class AbstractJobIntegrationTest extends AbstractIntegrationTest {

    /** The real store (local, or S3 where a subclass configures it), stubbable per test. */
    @MockitoSpyBean
    protected ImageStore imageStore;

    @Autowired
    protected MutableClock clock;

    @Autowired
    private MediaCleanupService mediaCleanupService;

    @Autowired
    private JdbcTemplate jobJdbc;

    @BeforeEach
    void resetClock() {
        clock.set(Instant.now());
    }

    /**
     * Works off every cleanup row other test classes left due, with the real
     * worker, so the 50-row batch a test asserts on is never crowded out by
     * someone else's backlog. Rows that fail are rescheduled into the future
     * and stop being due, so this terminates.
     */
    @BeforeEach
    void drainDueMediaCleanup() {
        for (int run = 0; run < 20 && dueCleanups() > 0; run++) {
            mediaCleanupService.processDue();
        }
    }

    private long dueCleanups() {
        // The worker decides "due" by the application clock, so this does too.
        return jobJdbc.queryForObject(
                "SELECT count(*) FROM media_cleanup WHERE status = 'PENDING' AND next_attempt_at <= ?",
                Long.class, java.sql.Timestamp.from(Instant.now()));
    }
}
