package ma.dari.api.moderation;

import java.time.Instant;
import java.util.UUID;

public record ReportResponse(
        UUID id,
        UUID reporterId,
        ReportTarget targetType,
        UUID targetId,
        ReportReason reason,
        String details,
        ReportStatus status,
        Instant createdAt
) {
    public static ReportResponse from(Report report) {
        return new ReportResponse(
                report.getId(),
                report.getReporter().getId(),
                report.getTargetType(),
                report.getTargetId(),
                report.getReason(),
                report.getDetails(),
                report.getStatus(),
                report.getCreatedAt()
        );
    }
}
