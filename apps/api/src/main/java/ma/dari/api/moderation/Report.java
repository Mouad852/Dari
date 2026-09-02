package ma.dari.api.moderation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import ma.dari.api.common.jpa.Ids;
import ma.dari.api.user.User;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "reports")
public class Report {

    @Id
    private UUID id = Ids.newId();

    @ManyToOne
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "target_type", nullable = false, columnDefinition = "report_target")
    private ReportTarget targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "report_reason")
    private ReportReason reason;

    @Column(columnDefinition = "text")
    private String details;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false, columnDefinition = "report_status")
    private ReportStatus status = ReportStatus.PENDING;

    @ManyToOne
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Report() {
    }

    public static Report create(User reporter, CreateReportRequest request) {
        Report report = new Report();
        report.reporter = reporter;
        report.targetType = request.targetType();
        report.targetId = request.targetId();
        report.reason = request.reason();
        report.details = request.details();
        report.status = ReportStatus.PENDING;
        return report;
    }

    public UUID getId() { return id; }
    public User getReporter() { return reporter; }
    public ReportTarget getTargetType() { return targetType; }
    public UUID getTargetId() { return targetId; }
    public ReportReason getReason() { return reason; }
    public String getDetails() { return details; }
    public ReportStatus getStatus() { return status; }
    public User getReviewedBy() { return reviewedBy; }
    public Instant getReviewedAt() { return reviewedAt; }
    public Instant getCreatedAt() { return createdAt; }

    public void setStatus(ReportStatus status) { this.status = status; }
    public void setReviewedBy(User reviewedBy) { this.reviewedBy = reviewedBy; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
}
