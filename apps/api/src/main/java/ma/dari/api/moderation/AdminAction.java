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
@Table(name = "admin_actions")
public class AdminAction {

    @Id
    private UUID id = Ids.newId();

    @ManyToOne
    @JoinColumn(name = "admin_id", nullable = false)
    private User admin;

    @Column(nullable = false)
    private String action;

    @Enumerated(jakarta.persistence.EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "target_type", nullable = false, columnDefinition = "report_target")
    private ReportTarget targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Column(columnDefinition = "text")
    private String reason;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected AdminAction() {
    }

    public static AdminAction of(User admin, String action, ReportTarget targetType, UUID targetId, String reason) {
        AdminAction audit = new AdminAction();
        audit.admin = admin;
        audit.action = action;
        audit.targetType = targetType;
        audit.targetId = targetId;
        audit.reason = reason;
        return audit;
    }

    public UUID getId() { return id; }
    public User getAdmin() { return admin; }
    public String getAction() { return action; }
    public ReportTarget getTargetType() { return targetType; }
    public UUID getTargetId() { return targetId; }
    public String getReason() { return reason; }
    public Instant getCreatedAt() { return createdAt; }
}
