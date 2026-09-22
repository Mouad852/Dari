package ma.dari.api.media;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface MediaCleanupRepository extends JpaRepository<MediaCleanup, UUID> {
    @Query("select m from MediaCleanup m where m.status = :status and m.nextAttemptAt <= :now order by m.createdAt asc")
    List<MediaCleanup> findDue(@Param("status") MediaCleanupStatus status,
                               @Param("now") Instant now, Pageable pageable);
    long countByStatus(MediaCleanupStatus status);
    long countByStatusAndAttemptsGreaterThan(MediaCleanupStatus status, int attempts);
    boolean existsByStorageKeyAndStatus(String storageKey, MediaCleanupStatus status);

    /** Any row at all means the key was revoked: keys are never reused, and nothing un-revokes one. */
    boolean existsByStorageKey(String storageKey);

    /**
     * Enqueues a key unless a row for it already exists, whatever its status.
     * The unique storage_key decides, so two transactions enqueuing the same
     * key at once cannot both insert and neither fails.
     */
    @Modifying
    @Query(value = """
            insert into media_cleanup (id, storage_key, status, attempts, next_attempt_at, created_at, updated_at)
            values (:id, :storageKey, 'PENDING', 0, now(), now(), now())
            on conflict (storage_key) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(@Param("id") UUID id, @Param("storageKey") String storageKey);
}
