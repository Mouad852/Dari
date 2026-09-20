package ma.dari.api.media;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;

@Service
public class MediaCleanupService {
    private final MediaCleanupRepository cleanups;
    private final ImageStore imageStore;

    public MediaCleanupService(MediaCleanupRepository cleanups, ImageStore imageStore) {
        this.cleanups = cleanups;
        this.imageStore = imageStore;
    }

    @Transactional
    public void enqueue(String storageKey) {
        if (storageKey == null || storageKey.isBlank()
                || cleanups.existsByStorageKeyAndStatus(storageKey, MediaCleanupStatus.PENDING)
                || cleanups.existsByStorageKeyAndStatus(storageKey, MediaCleanupStatus.DELETED)) return;
        cleanups.save(new MediaCleanup(storageKey));
    }

    @Scheduled(fixedDelayString = "${dari.media.cleanup-interval-ms:60000}")
    public void processDue() {
        for (MediaCleanup cleanup : cleanups.findDue(MediaCleanupStatus.PENDING, Instant.now(), PageRequest.of(0, 100))) {
            try {
                imageStore.delete(cleanup.getStorageKey());
                cleanup.setStatus(MediaCleanupStatus.DELETED);
                cleanup.setUpdatedAt(Instant.now());
            } catch (RuntimeException failure) {
                cleanup.setAttempts(cleanup.getAttempts() + 1);
                cleanup.setLastError(failure.getClass().getSimpleName() + ": " + failure.getMessage());
                cleanup.setNextAttemptAt(Instant.now().plusSeconds(Math.min(3600, 30L << Math.min(cleanup.getAttempts(), 7))));
                cleanup.setUpdatedAt(Instant.now());
            }
            cleanups.save(cleanup);
        }
    }
}
