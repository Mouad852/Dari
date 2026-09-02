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
        boolean autoFlagged,
        /**
         * Reports previously dismissed from the same set of reporters. Context
         * for weighing the item, not a verdict on it.
         */
        long priorDismissedReports,
        /** Human label for the target: a listing title, or a user's display name. */
        String targetLabel
) {
}
