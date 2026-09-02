package ma.dari.api.moderation;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminReportQueueItem(
        ReportTarget targetType,
        UUID targetId,
        long reportCount,
        long reporterCount,
        Instant firstReportedAt,
        List<ReportReason> reasons,
        boolean autoFlagged
) {
}
