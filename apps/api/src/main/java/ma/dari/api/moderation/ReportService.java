package ma.dari.api.moderation;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.listing.Listing;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import ma.dari.api.user.UserStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
public class ReportService {

    private final ReportRepository reports;
    private final ListingRepository listings;
    private final UserRepository users;

    public ReportService(ReportRepository reports, ListingRepository listings, UserRepository users) {
        this.reports = reports;
        this.listings = listings;
        this.users = users;
    }

    @Transactional
    public Report create(User reporter, CreateReportRequest request) {
        validateTargetExists(request.targetType(), request.targetId());
        rejectSelfReport(reporter, request.targetType(), request.targetId());

        if (reports.existsByReporterIdAndTargetTypeAndTargetIdAndStatus(
                reporter.getId(), request.targetType(), request.targetId(), ReportStatus.PENDING)) {
            throw new ApiException(409, ErrorCode.ALREADY_REPORTED, "Signalement déjà en cours");
        }

        Report report = reports.save(Report.create(reporter, request));

        long distinctReporters = reports.countDistinctReportersSince(
                request.targetType(),
                request.targetId(),
                ReportStatus.PENDING,
                Instant.now().minus(7, ChronoUnit.DAYS));

        if (distinctReporters >= 3) {
            autoSuspendTarget(request.targetType(), request.targetId());
        }

        return report;
    }

    @Transactional(readOnly = true)
    public List<ReportResponse> mine(User reporter) {
        return reports.findByReporterIdOrderByCreatedAtDesc(reporter.getId()).stream()
                .map(ReportResponse::from)
                .toList();
    }

    @Transactional
    public void dismissPendingReports(User admin, ReportTarget targetType, UUID targetId, String reason) {
        resolvePendingReports(admin, targetType, targetId, ReportStatus.DISMISSED, reason);
    }

    /**
     * Closes every pending report against one target with the given outcome.
     *
     * <p>The resolved status is not cosmetic. {@code DISMISSED} says the reports
     * were unfounded and is the only outcome that restores an auto-suspended
     * target; {@code ACTION_TAKEN} says the moderator acted on them. Collapsing
     * the two would make the queue's own history useless for judging whether
     * the auto-suspend threshold is calibrated.
     */
    @Transactional
    public void resolvePendingReports(User admin,
                                      ReportTarget targetType,
                                      UUID targetId,
                                      ReportStatus outcome,
                                      String reason) {
        for (Report report : reports.findByTargetTypeAndTargetIdAndStatus(targetType, targetId, ReportStatus.PENDING)) {
            report.setStatus(outcome);
            report.setReviewedBy(admin);
            report.setReviewedAt(Instant.now());
            reports.save(report);
        }

        // Restoring is only ever correct when the reports were found unfounded.
        if (outcome != ReportStatus.DISMISSED) {
            return;
        }

        if (targetType == ReportTarget.LISTING) {
            Listing listing = listings.findById(targetId)
                    .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));
            if (listing.isAutoFlagged() && listing.getStatus() == ListingStatus.SUSPENDED) {
                listing.setStatus(listing.getPriorStatus() != null ? listing.getPriorStatus() : ListingStatus.PUBLISHED);
                listing.setPriorStatus(null);
                listing.setAutoFlagged(false);
                listings.save(listing);
            }
        }
    }

    /**
     * Reporting yourself is never a real report.
     *
     * <p>Enforced here rather than by hiding the button, because the reporter's
     * identity comes from the token and the UI cannot be the thing that decides
     * it. It also keeps the moderation queue free of rows no moderator can act
     * on: the auto-suspend threshold counts *distinct* reporters, so a
     * self-report could never trip it either — it would only ever be noise.
     */
    private void rejectSelfReport(User reporter, ReportTarget targetType, UUID targetId) {
        boolean ownContent = targetType == ReportTarget.USER
                ? targetId.equals(reporter.getId())
                : listings.findById(targetId)
                        .map(listing -> listing.getOwner().getId().equals(reporter.getId()))
                        .orElse(false);

        if (ownContent) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED,
                    "Vous ne pouvez pas signaler votre propre contenu");
        }
    }

    private void validateTargetExists(ReportTarget targetType, UUID targetId) {
        if (targetType == ReportTarget.LISTING) {
            if (!listings.existsById(targetId)) {
                throw new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable");
            }
            return;
        }

        if (!users.existsById(targetId)) {
            throw new ApiException(404, ErrorCode.NOT_FOUND, "Utilisateur introuvable");
        }
    }

    private void autoSuspendTarget(ReportTarget targetType, UUID targetId) {
        if (targetType == ReportTarget.LISTING) {
            Listing listing = listings.findById(targetId)
                    .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));
            if (listing.getStatus() == ListingStatus.SUSPENDED) {
                return;
            }
            listing.setPriorStatus(listing.getStatus());
            listing.setStatus(ListingStatus.SUSPENDED);
            listing.setAutoFlagged(true);
            listings.save(listing);
            return;
        }

        User user = users.findById(targetId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Utilisateur introuvable"));
        if (user.getStatus() == UserStatus.BANNED || user.getStatus() == UserStatus.SUSPENDED) {
            return;
        }
        user.setStatus(UserStatus.SUSPENDED);
        users.save(user);
    }
}
