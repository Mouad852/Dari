package ma.dari.api.moderation;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.common.pagination.Cursor;
import ma.dari.api.common.pagination.CursorPage;
import ma.dari.api.common.pagination.TypedCursors;
import ma.dari.api.listing.HouseRulesRepository;
import ma.dari.api.listing.Listing;
import ma.dari.api.listing.ListingAmenityRepository;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.listing.ListingRoomRepository;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.listing.ListingCovers;
import ma.dari.api.listing.dto.HouseRulesResponse;
import ma.dari.api.listing.dto.ListingResponse;
import ma.dari.api.listing.dto.ListingRoomResponse;
import ma.dari.api.notification.NotificationService;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import ma.dari.api.user.UserStatus;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminService {

    private final ListingRepository listings;
    private final ListingAmenityRepository listingAmenities;
    private final HouseRulesRepository houseRules;
    private final ListingRoomRepository rooms;
    private final ListingCovers covers;
    private final AdminActionRepository adminActions;
    private final ReportRepository reports;
    private final ReportService reportService;
    private final NotificationService notifications;
    private final UserRepository users;
    private final BannedIdentityRepository bannedIdentities;

    public AdminService(ListingRepository listings,
                       ListingAmenityRepository listingAmenities,
                       HouseRulesRepository houseRules,
                       ListingRoomRepository rooms,
                       ListingCovers covers,
                       AdminActionRepository adminActions,
                       ReportRepository reports,
                       ReportService reportService,
                       NotificationService notifications,
                       UserRepository users,
                       BannedIdentityRepository bannedIdentities) {
        this.listings = listings;
        this.listingAmenities = listingAmenities;
        this.houseRules = houseRules;
        this.rooms = rooms;
        this.covers = covers;
        this.adminActions = adminActions;
        this.reports = reports;
        this.reportService = reportService;
        this.notifications = notifications;
        this.users = users;
        this.bannedIdentities = bannedIdentities;
    }

    @Transactional(readOnly = true)
    public List<ListingResponse> pendingListings() {
        List<Listing> rows = listings.findByStatusAndDeletedAtIsNull(ListingStatus.PENDING_REVIEW);
        // One query for the whole queue, not one per row: a moderator opening a
        // backlog of fifty should not cost fifty round trips to see fifty photos.
        Map<UUID, String> coverUrls = covers.forEach(rows);
        return rows.stream()
                .map(listing -> ListingResponse.from(listing, amenityCodesFor(listing.getId()),
                        coverUrls.get(listing.getId()), houseRulesFor(listing.getId()), roomsFor(listing.getId())))
                .toList();
    }

    private Set<String> amenityCodesFor(UUID listingId) {
        return new HashSet<>(listingAmenities.findAmenityCodesByListingId(listingId));
    }

    private HouseRulesResponse houseRulesFor(UUID listingId) {
        return houseRules.findById(listingId).map(HouseRulesResponse::from).orElse(null);
    }

    private List<ListingRoomResponse> roomsFor(UUID listingId) {
        return rooms.findByListingIdOrderByCreatedAtAsc(listingId).stream()
                .map(ListingRoomResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CursorPage<AdminUserResponse> searchUsers(String query, UserStatus status, String cursor) {
        String normalizedQuery = query == null || query.isBlank()
                ? null : "%" + query.trim().toLowerCase(Locale.ROOT) + "%";
        String queryKey = String.valueOf(status) + "|" + String.valueOf(normalizedQuery);
        TypedCursors.AdminCursor decoded = cursor == null ? null : TypedCursors.admin(cursor, queryKey);
        List<User> rows;
        if (decoded == null) {
            rows = status == null
                    ? users.searchVisible(normalizedQuery, PageRequest.of(0, 21))
                    : users.searchVisibleByStatus(status, normalizedQuery, PageRequest.of(0, 21));
        } else {
            rows = status == null
                    ? users.searchVisibleAfter(normalizedQuery, decoded.lastCreatedAt(), decoded.lastId(), PageRequest.of(0, 21))
                    : users.searchVisibleByStatusAfter(status, normalizedQuery,
                    decoded.lastCreatedAt(), decoded.lastId(), PageRequest.of(0, 21));
        }
        boolean hasMore = rows.size() > 20;
        List<User> pageRows = hasMore ? rows.subList(0, 20) : rows;
        List<UUID> userIds = pageRows.stream().map(User::getId).toList();
        Map<UUID, Long> reportCounts = userIds.isEmpty() ? Map.of()
                : reports.countByTargetTypeAndTargetIdIn(ReportTarget.USER, userIds).stream()
                .collect(java.util.stream.Collectors.toMap(ReportRepository.TargetCount::getTargetId,
                        ReportRepository.TargetCount::getReportCount));
        List<AdminUserResponse> items = pageRows.stream()
                .map(user -> AdminUserResponse.from(user, reportCounts.getOrDefault(user.getId(), 0L)))
                .toList();
        String nextCursor = null;
        if (hasMore && !pageRows.isEmpty()) {
            User last = pageRows.get(pageRows.size() - 1);
            var payload = Cursor.newPayload();
            payload.put("mode", "admin-users");
            payload.put("queryKey", queryKey);
            payload.put("lastCreatedAt", last.getCreatedAt().toString());
            payload.put("lastId", last.getId().toString());
            nextCursor = Cursor.encode(payload);
        }
        return CursorPage.of(items, nextCursor);
    }

    @Transactional(readOnly = true)
    public List<AdminReportQueueItem> pendingReportQueue() {
        Map<String, QueueEntry> grouped = new HashMap<>();

        for (Report report : reports.findByStatus(ReportStatus.PENDING)) {
            String key = report.getTargetType() + ":" + report.getTargetId();
            QueueEntry entry = grouped.computeIfAbsent(key, ignored -> new QueueEntry(report.getTargetType(), report.getTargetId()));
            entry.reportCount++;
            entry.reporterIds.add(report.getReporter().getId());
            entry.reasons.add(report.getReason());
            if (report.getDetails() != null && !report.getDetails().isBlank()) {
                entry.details.add(report.getDetails());
            }
            entry.firstReportedAt = entry.firstReportedAt == null || report.getCreatedAt().isBefore(entry.firstReportedAt)
                    ? report.getCreatedAt()
                    : entry.firstReportedAt;
        }

        Set<UUID> listingIds = grouped.values().stream()
                .filter(entry -> entry.targetType == ReportTarget.LISTING)
                .map(entry -> entry.targetId)
                .collect(java.util.stream.Collectors.toSet());
        Set<UUID> userIds = grouped.values().stream()
                .filter(entry -> entry.targetType == ReportTarget.USER)
                .map(entry -> entry.targetId)
                .collect(java.util.stream.Collectors.toSet());
        Map<UUID, Listing> listingsById = listings.findAllById(listingIds).stream()
                .collect(java.util.stream.Collectors.toMap(Listing::getId, listing -> listing));
        Map<UUID, User> usersById = users.findAllById(userIds).stream()
                .collect(java.util.stream.Collectors.toMap(User::getId, user -> user));
        Set<UUID> reporterIds = grouped.values().stream()
                .flatMap(entry -> entry.reporterIds.stream())
                .collect(java.util.stream.Collectors.toSet());
        Map<UUID, Long> dismissedByReporter = reporterIds.isEmpty() ? Map.of()
                : reports.countByReporterIdInAndStatusGrouped(reporterIds, ReportStatus.DISMISSED).stream()
                .collect(java.util.stream.Collectors.toMap(ReportRepository.ReporterCount::getReporterId,
                        ReportRepository.ReporterCount::getReportCount));

        return grouped.values().stream()
                .map(entry -> new AdminReportQueueItem(
                        entry.targetType,
                        entry.targetId,
                        entry.reportCount,
                        entry.reporterIds.size(),
                        entry.firstReportedAt,
                        entry.reasons.stream().distinct().sorted(Comparator.comparing(Enum::name)).toList(),
                        List.copyOf(entry.details),
                        isAutoFlagged(entry.targetType, entry.targetId, listingsById),
                        entry.reporterIds.stream().mapToLong(id -> dismissedByReporter.getOrDefault(id, 0L)).sum(),
                        targetLabel(entry.targetType, entry.targetId, listingsById, usersById)
                ))
                .sorted(Comparator
                        .comparing((AdminReportQueueItem item) -> !item.autoFlagged())
                        .thenComparing(Comparator.comparingLong(AdminReportQueueItem::reportCount).reversed())
                        .thenComparing(AdminReportQueueItem::firstReportedAt))
                .toList();
    }

    /**
     * Resolved here rather than by the console fetching each row.
     *
     * <p>A USER target had no label at all before — there was no single-user
     * admin read, so the queue showed a truncated UUID and a moderator had to
     * decide about a person they could not name. Doing it server-side also
     * avoids one request per row, and works for soft-deleted targets, which a
     * public read would 404 on.
     */
    private String targetLabel(ReportTarget targetType, UUID targetId,
                               Map<UUID, Listing> listingsById, Map<UUID, User> usersById) {
        if (targetType == ReportTarget.LISTING) {
            return listingsById.containsKey(targetId) ? listingsById.get(targetId).getTitle() : null;
        }
        return usersById.containsKey(targetId) ? usersById.get(targetId).getDisplayName() : null;
    }

    private boolean isAutoFlagged(ReportTarget targetType, UUID targetId, Map<UUID, Listing> listingsById) {
        if (targetType == ReportTarget.LISTING) {
            return listingsById.containsKey(targetId) && listingsById.get(targetId).isAutoFlagged();
        }
        return false;
    }

    private static class QueueEntry {
        private final ReportTarget targetType;
        private final UUID targetId;
        private long reportCount;
        private final Set<UUID> reporterIds = new HashSet<>();
        private final List<ReportReason> reasons = new ArrayList<>();
        private final List<String> details = new ArrayList<>();
        private Instant firstReportedAt;

        private QueueEntry(ReportTarget targetType, UUID targetId) {
            this.targetType = targetType;
            this.targetId = targetId;
        }
    }

    @Transactional
    public ListingResponse approveListing(User admin, UUID listingId) {
        Listing listing = listings.findById(listingId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));
        if (listing.getStatus() != ListingStatus.PENDING_REVIEW) {
            throw new ApiException(409, ErrorCode.ILLEGAL_TRANSITION, "Transition illégale: PENDING_REVIEW -> PUBLISHED");
        }
        listing.setStatus(ListingStatus.PUBLISHED);
        listing.setPriorStatus(null);
        listing.setRejectionReason(null);
        listings.save(listing);
        notifications.listingApproved(listing);
        adminActions.save(AdminAction.of(admin, "APPROVE_LISTING", ReportTarget.LISTING, listingId, null));
        return ListingResponse.from(listing, amenityCodesFor(listing.getId()), covers.forListing(listing.getId()),
                houseRulesFor(listing.getId()), roomsFor(listing.getId()));
    }

    @Transactional
    public ListingResponse rejectListing(User admin, UUID listingId, String reason) {
        Listing listing = listings.findById(listingId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));
        if (listing.getStatus() != ListingStatus.PENDING_REVIEW) {
            throw new ApiException(409, ErrorCode.ILLEGAL_TRANSITION, "Transition illégale: PENDING_REVIEW -> REJECTED");
        }
        listing.setStatus(ListingStatus.REJECTED);
        listing.setRejectionReason(reason);
        listings.save(listing);
        notifications.listingRejected(listing, reason);
        adminActions.save(AdminAction.of(admin, "REJECT_LISTING", ReportTarget.LISTING, listingId, reason));
        return ListingResponse.from(listing, amenityCodesFor(listing.getId()), covers.forListing(listing.getId()),
                houseRulesFor(listing.getId()), roomsFor(listing.getId()));
    }

    @Transactional
    public void dismissReports(User admin, ReportTarget targetType, UUID targetId, String action, String reason) {
        reportService.dismissPendingReports(admin, targetType, targetId, reason);
        adminActions.save(AdminAction.of(admin, action, targetType, targetId, reason));
    }

    /**
     * Resolves a queue item with a real decision.
     *
     * <p>{@link ModerationAction#WARN} sends a generic warning notification to
     * the target owner and resolves the reports as ACTION_TAKEN. The notification
     * message is determined by the event type (USER_WARNED) and no further details
     * are included to the target.
     */
    @Transactional
    public void actOnReports(User admin, ReportTarget targetType, UUID targetId, ModerationAction action, String reason) {
        switch (action) {
            case DISMISS -> {
                reportService.dismissPendingReports(admin, targetType, targetId, reason);
                adminActions.save(AdminAction.of(admin, "DISMISS", targetType, targetId, reason));
            }
            case SUSPEND -> {
                if (targetType == ReportTarget.LISTING) {
                    suspendListing(admin, targetId, reason);
                } else {
                    suspendUser(admin, targetId);
                }
                reportService.resolvePendingReports(admin, targetType, targetId, ReportStatus.ACTION_TAKEN, reason);
                adminActions.save(AdminAction.of(admin, "SUSPEND", targetType, targetId, reason));
            }
            case BAN -> {
                if (targetType != ReportTarget.USER) {
                    throw new ApiException(400, ErrorCode.VALIDATION_FAILED,
                            "Un bannissement ne s'applique qu'à un utilisateur");
                }
                banUser(admin, targetId, reason);
                reportService.resolvePendingReports(admin, targetType, targetId, ReportStatus.ACTION_TAKEN, reason);
                adminActions.save(AdminAction.of(admin, "BAN", targetType, targetId, reason));
            }
            case WARN -> {
                if (targetType == ReportTarget.LISTING) {
                    Listing listing = listings.findById(targetId)
                            .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));
                    notifications.userWarned(listing.getOwner(), reason);
                } else {
                    User user = users.findById(targetId)
                            .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Utilisateur introuvable"));
                    notifications.userWarned(user, reason);
                }
                reportService.resolvePendingReports(admin, targetType, targetId, ReportStatus.ACTION_TAKEN, reason);
                adminActions.save(AdminAction.of(admin, "WARN", targetType, targetId, reason));
            }
        }
    }

    /**
     * A moderator's deliberate suspension, as distinct from the automatic one.
     *
     * <p>{@code autoFlagged} stays false: the flag exists so a DISMISS knows
     * whether it is undoing the system's own decision. Setting it here would let
     * a later dismissal silently republish a listing a human chose to take down.
     */
    @Transactional
    public void suspendListing(User admin, UUID listingId, String reason) {
        Listing listing = listings.findById(listingId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

        if (listing.getStatus() == ListingStatus.SUSPENDED) {
            return;
        }
        listing.setPriorStatus(listing.getStatus());
        listing.setStatus(ListingStatus.SUSPENDED);
        listing.setAutoFlagged(false);
        listing.setRejectionReason(reason);
        listings.save(listing);
        notifications.listingSuspended(listing);
    }

    @Transactional(readOnly = true)
    public AdminUserResponse getUser(UUID userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Utilisateur introuvable"));
        return AdminUserResponse.from(user, reports.countByTargetTypeAndTargetId(ReportTarget.USER, userId));
    }

    @Transactional
    public void suspendUser(User admin, UUID userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Utilisateur introuvable"));

        if (user.getStatus() == UserStatus.BANNED) {
            throw new ApiException(409, ErrorCode.ILLEGAL_TRANSITION, "L'utilisateur est déjà banni");
        }
        if (user.getStatus() == UserStatus.SUSPENDED) {
            return;
        }

        // A moderator's suspension is deliberate, so it must never be treated as automatic.
        user.setAutoSuspended(false);
        user.setStatus(UserStatus.SUSPENDED);
        users.save(user);
        notifications.userSuspended(user, "Votre compte a été suspendu par la modération");
        adminActions.save(AdminAction.of(admin, "SUSPEND_USER", ReportTarget.USER, userId, null));
    }

    @Transactional
    public void reactivateUser(User admin, UUID userId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Utilisateur introuvable"));

        if (user.getStatus() == UserStatus.ACTIVE) {
            return;
        }
        if (user.getStatus() == UserStatus.BANNED) {
            throw new ApiException(409, ErrorCode.ILLEGAL_TRANSITION, "Un compte banni ne peut pas être réactivé");
        }

        user.setStatus(UserStatus.ACTIVE);
        user.setAutoSuspended(false);
        users.save(user);
        adminActions.save(AdminAction.of(admin, "REACTIVATE_USER", ReportTarget.USER, userId, null));
    }

    @Transactional
    public void banUser(User admin, UUID userId, String reason) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Utilisateur introuvable"));

        if (user.getStatus() == UserStatus.BANNED) {
            return;
        }

        user.setStatus(UserStatus.BANNED);
        users.save(user);
        notifications.userBanned(user, reason == null || reason.isBlank()
                ? "Votre compte a été banni de Dari"
                : reason);

        listings.findByOwnerId(userId).forEach(listing -> {
            listing.setStatus(ListingStatus.SUSPENDED);
            listing.setDeletedAt(Instant.now());
            listings.save(listing);
        });

        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            BannedIdentity bannedIdentity = BannedIdentity.of(user);
            if (!bannedIdentities.existsByEmailLower(bannedIdentity.getEmailLower())) {
                bannedIdentities.save(bannedIdentity);
            }
        }

        adminActions.save(AdminAction.of(admin, "BAN_USER", ReportTarget.USER, userId, reason));
    }
}
