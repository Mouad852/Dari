package ma.dari.api.media;

import io.micrometer.core.instrument.MeterRegistry;
import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.support.AbstractJobIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * The cleanup worker against the real database: a terminal DEAD state, a
 * single flight across concurrent runs, idempotent enqueueing, and per-row
 * failure isolation.
 */
class MediaCleanupDeadLetterIntegrationTest extends AbstractJobIntegrationTest {

    @Autowired
    MediaCleanupService mediaCleanup;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    TransactionTemplate transactions;

    @Autowired
    MeterRegistry meters;

    @Value("${dari.upload-dir:./uploads}")
    String uploadDir;

    @Value("${dari.media.cleanup-max-attempts:10}")
    int maxAttempts;

    @Test
    void aPermanentlyFailingKeyGoesDeadStaysHiddenAndIsNotRetried() throws Exception {
        String key = newKey();
        Path file = writeFile(key);
        doThrow(new ApiException(503, ErrorCode.INTERNAL_ERROR, "La suppression de la photo a échoué",
                new IllegalStateException("S3 DELETE failed: HTTP 403")))
                .when(imageStore).delete(key);
        double deadBefore = meters.counter("dari.media.cleanup", "outcome", "dead").count();

        mediaCleanup.enqueue(key);
        for (int attempt = 1; attempt < maxAttempts; attempt++) {
            mediaCleanup.processDue();
            assertThat(status(key)).isEqualTo("PENDING");
            assertThat(attempts(key)).isEqualTo(attempt);
            makeDue(key);
        }
        mediaCleanup.processDue();

        assertThat(maxAttempts).isEqualTo(10);
        assertThat(status(key)).isEqualTo("DEAD");
        assertThat(attempts(key)).isEqualTo(maxAttempts);
        assertThat(lastError(key)).isEqualTo(
                "ApiException: La suppression de la photo a échoué (S3 DELETE failed: HTTP 403)");
        assertThat(meters.counter("dari.media.cleanup", "outcome", "dead").count()).isEqualTo(deadBefore + 1);

        // DEAD is terminal: due or not, the worker never touches it again.
        makeDue(key);
        mediaCleanup.processDue();
        assertThat(status(key)).isEqualTo("DEAD");
        assertThat(attempts(key)).isEqualTo(maxAttempts);
        verify(imageStore, times(maxAttempts)).delete(key);

        // The file is still on disk, and it must stay unreadable.
        assertThat(file).exists();
        given().basePath("").when().get("/uploads/" + key).then().statusCode(404);

        Long deadRows = jdbc.queryForObject("SELECT count(*) FROM media_cleanup WHERE status = 'DEAD'", Long.class);
        assertThat(deadRows).isPositive();
        assertThat(meters.get("dari.media.cleanup_depth").tag("status", "DEAD").gauge().value())
                .isEqualTo(deadRows.doubleValue());
    }

    @Test
    void enqueueingAKeyThatAlreadyHasARowIsANoOpEvenConcurrently() throws Exception {
        String key = newKey();
        mediaCleanup.enqueue(key);
        mediaCleanup.enqueue(key);
        assertThat(rows(key)).isEqualTo(1);

        String contended = newKey();
        int callers = 8;
        CyclicBarrier start = new CyclicBarrier(callers);
        ExecutorService pool = Executors.newFixedThreadPool(callers);
        try {
            List<Future<?>> results = new ArrayList<>();
            for (int i = 0; i < callers; i++) {
                results.add(pool.submit(() -> {
                    start.await(10, TimeUnit.SECONDS);
                    mediaCleanup.enqueue(contended);
                    return null;
                }));
            }
            for (Future<?> result : results) {
                result.get(30, TimeUnit.SECONDS);   // rethrows any unique violation
            }
        } finally {
            pool.shutdownNow();
        }
        assertThat(rows(contended)).isEqualTo(1);

        // A DEAD key used to be the one a re-enqueue could not skip: the
        // exists-then-save check knew only PENDING and DELETED, so it hit the
        // unique index and rolled the caller's transaction back.
        String dead = newKey();
        jdbc.update("INSERT INTO media_cleanup (id, storage_key, status, attempts) VALUES (?, ?, 'DEAD', 10)",
                UUID.randomUUID(), dead);
        String fresh = newKey();
        transactions.executeWithoutResult(status -> {
            mediaCleanup.enqueue(dead);
            mediaCleanup.enqueue(fresh);
        });
        assertThat(status(dead)).isEqualTo("DEAD");
        assertThat(attempts(dead)).isEqualTo(10);
        assertThat(status(fresh)).as("the caller's transaction committed").isEqualTo("PENDING");
    }

    @Test
    void twoConcurrentRunsDeleteAKeyExactlyOnce() throws Exception {
        String key = newKey();
        Path file = writeFile(key);
        mediaCleanup.enqueue(key);
        CountDownLatch deleting = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(invocation -> {
            deleting.countDown();
            release.await(30, TimeUnit.SECONDS);
            return invocation.callRealMethod();
        }).when(imageStore).delete(key);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> first = pool.submit(() -> mediaCleanup.processDue());
            assertThat(deleting.await(30, TimeUnit.SECONDS)).isTrue();

            // The first run is inside the storage call and holds the lock, so
            // this one must return at once without touching the row. Without
            // the lock it would reach the same PENDING row and block here.
            long started = System.nanoTime();
            pool.submit(() -> mediaCleanup.processDue()).get(10, TimeUnit.SECONDS);
            assertThat(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started)).isLessThan(10_000);

            release.countDown();
            first.get(30, TimeUnit.SECONDS);
        } finally {
            release.countDown();
            pool.shutdownNow();
        }

        verify(imageStore, times(1)).delete(key);
        assertThat(status(key)).isEqualTo("DELETED");
        assertThat(file).doesNotExist();
    }

    @Test
    void aRowThatCannotBeSavedDoesNotCostTheOthersTheirUpdates() throws Exception {
        String before = newKey();
        String poisoned = newKey();
        String after = newKey();
        for (String key : List.of(before, poisoned, after)) {
            writeFile(key);
            mediaCleanup.enqueue(key);
        }
        double errorsBefore = meters.counter("dari.media.cleanup", "outcome", "error").count();

        // A real database failure on exactly one row's update.
        jdbc.execute("""
                CREATE FUNCTION test_poison_media_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    IF NEW.storage_key = '%s' THEN RAISE EXCEPTION 'poisoned row for the test'; END IF;
                    RETURN NEW;
                END $$""".formatted(poisoned));
        jdbc.execute("CREATE TRIGGER test_poison_media_cleanup BEFORE UPDATE ON media_cleanup "
                + "FOR EACH ROW EXECUTE FUNCTION test_poison_media_cleanup()");
        try {
            mediaCleanup.processDue();
        } finally {
            jdbc.execute("DROP TRIGGER test_poison_media_cleanup ON media_cleanup");
            jdbc.execute("DROP FUNCTION test_poison_media_cleanup()");
        }

        assertThat(status(before)).isEqualTo("DELETED");
        assertThat(status(after)).as("processed after the failure").isEqualTo("DELETED");
        assertThat(status(poisoned)).as("left for the next run").isEqualTo("PENDING");
        assertThat(meters.counter("dari.media.cleanup", "outcome", "error").count()).isEqualTo(errorsBefore + 1);

        // Its object is already gone, and deleting an absent object succeeds,
        // so the next run settles it.
        mediaCleanup.processDue();
        assertThat(status(poisoned)).isEqualTo("DELETED");
    }

    private static String newKey() {
        return "listings/" + UUID.randomUUID() + "/" + UUID.randomUUID() + ".jpg";
    }

    private Path writeFile(String key) throws Exception {
        Path file = Path.of(uploadDir).toAbsolutePath().normalize().resolve(key);
        Files.createDirectories(file.getParent());
        Files.write(file, new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xD9});
        return file;
    }

    private void makeDue(String key) {
        jdbc.update("UPDATE media_cleanup SET next_attempt_at = now() - interval '1 second' WHERE storage_key = ?", key);
    }

    private String status(String key) {
        return jdbc.queryForObject("SELECT status FROM media_cleanup WHERE storage_key = ?", String.class, key);
    }

    private int attempts(String key) {
        return jdbc.queryForObject("SELECT attempts FROM media_cleanup WHERE storage_key = ?", Integer.class, key);
    }

    private String lastError(String key) {
        return jdbc.queryForObject("SELECT last_error FROM media_cleanup WHERE storage_key = ?", String.class, key);
    }

    private long rows(String key) {
        return jdbc.queryForObject("SELECT count(*) FROM media_cleanup WHERE storage_key = ?", Long.class, key);
    }
}
