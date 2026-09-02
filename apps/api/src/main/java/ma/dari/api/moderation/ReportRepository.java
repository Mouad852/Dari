package ma.dari.api.moderation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ReportRepository extends JpaRepository<Report, UUID> {

    boolean existsByReporterIdAndTargetTypeAndTargetIdAndStatus(
            UUID reporterId,
            ReportTarget targetType,
            UUID targetId,
            ReportStatus status
    );

    List<Report> findByStatus(ReportStatus status);

    List<Report> findByReporterIdOrderByCreatedAtDesc(UUID reporterId);

    List<Report> findByTargetTypeAndTargetIdAndStatus(
            ReportTarget targetType,
            UUID targetId,
            ReportStatus status
    );

    long countByTargetTypeAndTargetId(ReportTarget targetType, UUID targetId);

    /**
     * How many reports these reporters have had dismissed before.
     *
     * <p>A moderator weighing a queue item needs to know whether it comes from
     * people who are usually right. Three reports from reporters with a long
     * dismissal history is a different decision from three from first-time
     * reporters, and the raw count alone cannot tell them apart.
     */
    long countByReporterIdInAndStatus(Collection<UUID> reporterIds, ReportStatus status);

    @Query("select count(distinct r.reporter.id) from Report r " +
            "where r.targetType = :targetType and r.targetId = :targetId and r.status = :status and r.createdAt > :since")
    long countDistinctReportersSince(@Param("targetType") ReportTarget targetType,
                                    @Param("targetId") UUID targetId,
                                    @Param("status") ReportStatus status,
                                    @Param("since") Instant since);
}
