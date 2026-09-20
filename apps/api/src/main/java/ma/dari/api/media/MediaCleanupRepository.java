package ma.dari.api.media;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
