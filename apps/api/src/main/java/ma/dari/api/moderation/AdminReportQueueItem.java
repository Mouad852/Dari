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
        /**
         * Each report's free-text context, in the order reported. Was
         * captured on submission and returned by ReportResponse, but the
         * grouped admin queue never carried it -- a moderator saw only the
         * coarse reason category, never the detail a reporter actually
         * wrote. Found 2026-09-09.
         */
        List<String> details,
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
