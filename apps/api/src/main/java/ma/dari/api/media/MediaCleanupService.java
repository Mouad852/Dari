package ma.dari.api.media;

import io.micrometer.core.instrument.MeterRegistry;
import ma.dari.api.common.jpa.Ids;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;

@Service
public class MediaCleanupService {
    private static final Logger log = LoggerFactory.getLogger(MediaCleanupService.class);

    /** Rows per run. It sizes the scheduler lock below, so change the two together. */
    static final int BATCH_SIZE = 50;

    private final MediaCleanupRepository cleanups;
    private final ImageStore imageStore;
    private final MeterRegistry meterRegistry;
    private final int maxAttempts;

    public MediaCleanupService(MediaCleanupRepository cleanups, ImageStore imageStore,
                               MeterRegistry meterRegistry,
                               @Value("${dari.media.cleanup-max-attempts:10}") int maxAttempts) {
        this.cleanups = cleanups;
        this.imageStore = imageStore;
        this.meterRegistry = meterRegistry;
        this.maxAttempts = maxAttempts;
    }

    /**
     * Revokes a key and schedules its deletion, in the caller's transaction.
     * Idempotent at the database: enqueuing a key that already has a row, in
     * any status and even concurrently, is a no-op rather than a unique
     * violation that would roll the caller's work back.
     */
    @Transactional
    public void enqueue(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;
        cleanups.insertIfAbsent(Ids.newId(), storageKey);
    }

    /**
     * Deletes the objects that are due, one row at a time.
     *
     * <p>Single-flighted across instances. lockAtMostFor must outlast the
     * longest possible run, or a second instance could start on the same rows.
     * The worst case per row is one S3 DELETE with its retry, with the
     * S3ImageStore defaults 2 x (2 s connect + 10 s request) + 0.2 s backoff =
     * 24.2 s, so a full batch is BATCH_SIZE x 24.2 s = 50 x 24.2 s = 1210 s,
     * about 20 min; 25 min leaves margin. The cost of a long bound is that an
     * instance killed mid-run delays cleanup by up to 25 min. Raising the S3
     * timeouts or BATCH_SIZE means raising this too.
     *
     * <p>Deliberately not one transaction: each row's outcome is saved on its
     * own as soon as it is known, and the storage call runs with no database
     * transaction open. A row that cannot be saved is left PENDING for the next
     * run and does not cost the rest of the batch its updates.
     */
    @Scheduled(fixedDelayString = "${dari.media.cleanup-interval-ms:60000}")
    @SchedulerLock(name = "mediaCleanup", lockAtMostFor = "PT25M")
    public void processDue() {
        for (MediaCleanup cleanup : cleanups.findDue(MediaCleanupStatus.PENDING, Instant.now(), PageRequest.of(0, BATCH_SIZE))) {
            if (Thread.currentThread().isInterrupted()) {
                // Shutting down. Every storage call would now fail at once and
                // burn an attempt on each remaining row; leave them for later.
                return;
            }
            try {
                process(cleanup);
            } catch (RuntimeException unrecorded) {
                log.error("Media cleanup row {} could not be updated; it stays PENDING", cleanup.getId(), unrecorded);
                meterRegistry.counter("dari.media.cleanup", "outcome", "error").increment();
            }
        }
    }

    private void process(MediaCleanup cleanup) {
        String outcome;
        try {
            imageStore.delete(cleanup.getStorageKey());
            cleanup.setStatus(MediaCleanupStatus.DELETED);
            outcome = "deleted";
        } catch (RuntimeException failure) {
            int attempts = cleanup.getAttempts() + 1;
            cleanup.setAttempts(attempts);
            cleanup.setLastError(describe(failure));
            if (attempts >= maxAttempts) {
                cleanup.setStatus(MediaCleanupStatus.DEAD);
                outcome = "dead";
                log.error("Media cleanup row {} is DEAD after {} attempts ({})",
                        cleanup.getId(), attempts, cleanup.getLastError());
            } else {
                // 60 s, 2, 4, 8, 16, 32 min, then hourly: with the default of
                // 10 attempts a key goes DEAD about 4 h after its first failure.
                cleanup.setNextAttemptAt(Instant.now().plusSeconds(Math.min(3600, 30L << Math.min(attempts, 7))));
                outcome = "retry";
            }
        }
        cleanup.setUpdatedAt(Instant.now());
        cleanups.save(cleanup);
        meterRegistry.counter("dari.media.cleanup", "outcome", outcome).increment();
    }

    /** The operator-facing reason: the fixed user-facing message plus the technical cause, if any. */
    private static String describe(RuntimeException failure) {
        String description = failure.getClass().getSimpleName() + ": " + failure.getMessage();
        return failure.getCause() == null ? description : description + " (" + failure.getCause().getMessage() + ")";
    }
}
