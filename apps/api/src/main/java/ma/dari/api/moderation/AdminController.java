package ma.dari.api.moderation;

import jakarta.validation.Valid;
import ma.dari.api.common.auth.CurrentUser;
import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.listing.dto.ListingResponse;
import ma.dari.api.user.User;
import ma.dari.api.user.UserStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The moderator console (phase 06).
 *
 * <p>Role-gated twice: by the URL rule in {@code SecurityConfig} and by
 * {@code @PreAuthorize} here. Deliberate belt and braces — a future refactor of
 * the URL matchers must not silently open the moderation queue, which carries
 * reporter identities and exact coordinates.
 *
 * <p>Every action writes an audit row naming the admin, the target and the
 * decision. Moderation without a trail is unreviewable, and §6 requires it.
 */
@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final ReportRepository reportRepository;

    public AdminController(AdminService adminService, ReportRepository reportRepository) {
        this.adminService = adminService;
        this.reportRepository = reportRepository;
    }

    @GetMapping("/dashboard")
    public Map<String, Long> dashboard(@CurrentUser User admin) {
        return Map.of(
                "pendingReviews", (long) adminService.pendingListings().size(),
                "pendingReports", (long) reportRepository.findByStatus(ReportStatus.PENDING).size()
        );
    }

    // --- listing review ------------------------------------------------------

    /**
     * The review queue. A separate endpoint from public search, not the same one
     * with different params (§7) — it needs non-public statuses and
     * reporter-sensitive data that must never leak into the public path.
     */
    @GetMapping("/listings")
    public List<ListingResponse> listings(@RequestParam(required = false) ListingStatus status) {
        return status == null
                ? adminService.pendingListings()
                : adminService.pendingListings().stream()
                    .filter(l -> l.status() == status)
                    .toList();
    }

    /** PENDING_REVIEW -> PUBLISHED. Notifies the owner. */
    @PostMapping("/listings/{id}/approve")
    public ListingResponse approve(@CurrentUser User admin, @PathVariable UUID id) {
        return adminService.approveListing(admin, id);
    }

    /** PENDING_REVIEW -> REJECTED with a reason the owner can act on. */
    @PostMapping("/listings/{id}/reject")
    public ListingResponse reject(@CurrentUser User admin,
                                @PathVariable UUID id,
                                @Valid @RequestBody RejectListingRequest request) {
        return adminService.rejectListing(admin, id, request.reason());
    }

    // --- reports -------------------------------------------------------------

    /**
     * Grouped by target, not one row per report. Five reports about one listing
     * are one decision, and a flat list makes a moderator act five times or miss
     * the pattern entirely.
     */
    @GetMapping("/reports")
    public List<AdminReportQueueItem> reports() {
        return adminService.pendingReportQueue();
    }

    /**
     * Resolves every report against one target at once.
     *
     * <p>{@link ModerationAction#DISMISS} on an auto-suspended target restores
     * {@code prior_status}. Read that field; never hard-code PUBLISHED.
     */
    @PostMapping("/reports/{targetType}/{targetId}/action")
    public ResponseEntity<Map<String, String>> actOnReports(@CurrentUser User admin,
                                                           @PathVariable ReportTarget targetType,
                                                           @PathVariable UUID targetId,
                                                           @Valid @RequestBody AdminReportActionRequest request) {
        ModerationAction action;
        try {
            action = ModerationAction.valueOf(request.action().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Action inconnue");
        }
        adminService.actOnReports(admin, targetType, targetId, action, request.reason());
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    // --- users ---------------------------------------------------------------

    /** One user, so the report queue can name a USER target instead of showing an id. */
    @GetMapping("/users/{id}")
    public AdminUserResponse user(@PathVariable UUID id) {
        return adminService.getUser(id);
    }

    @GetMapping("/users")
    public List<AdminUserResponse> users(@RequestParam(required = false) String query,
                                       @RequestParam(required = false) UserStatus status) {
        return adminService.searchUsers(query, status);
    }

    /** Reversible. Conversation history stays reachable to the other party. */
    @PostMapping("/users/{id}/suspend")
    public ResponseEntity<Map<String, String>> suspend(@CurrentUser User admin, @PathVariable UUID id) {
        adminService.suspendUser(admin, id);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    /**
     * Terminal. Cascades: listings soft-deleted, the identity recorded so the
     * same email cannot re-register, and the auth filter rejects the token
     * before any controller runs.
     */
    @PostMapping("/users/{id}/ban")
    public ResponseEntity<Map<String, String>> ban(@CurrentUser User admin,
                                                  @PathVariable UUID id,
                                                  @Valid @RequestBody(required = false) BanUserRequest request) {
        adminService.banUser(admin, id, request == null ? null : request.reason());
        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
