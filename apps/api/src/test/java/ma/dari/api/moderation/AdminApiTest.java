package ma.dari.api.moderation;

import com.google.firebase.auth.FirebaseToken;
import jakarta.validation.Validator;
import ma.dari.api.listing.AvailabilityState;
import ma.dari.api.listing.Listing;
import ma.dari.api.listing.ListingPhoto;
import ma.dari.api.listing.ListingPhotoRepository;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.notification.NotificationOutbox;
import ma.dari.api.notification.NotificationOutboxRepository;
import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import ma.dari.api.user.UserRole;
import ma.dari.api.user.UserStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.hasKey;

/**
 * The admin console over HTTP.
 *
 * <p>{@link ReportApiTest} already covers parts of the moderation domain, but it
 * calls {@link AdminService} directly. That leaves the layer this class exists
 * for completely unexercised: the {@code hasRole('ADMIN')} URL matcher in
 * {@code SecurityConfig} and the {@code @PreAuthorize} on
 * {@link AdminController}, which are the two halves of the doubled role check
 * protecting every destructive action in the product. A service-level test
 * cannot fail when either is removed.
 */
class AdminApiTest extends AbstractIntegrationTest {

    @Autowired
    UserRepository users;

    @Autowired
    Validator validator;

    @Test
    @DisplayName("admin action input rejects blank action names")
    void adminActionRequiresName() {
        assertThat(validator.validate(new AdminReportActionRequest(" ", null)))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("action"));
    }

    @Autowired
    ListingRepository listings;

    @Autowired
    ReportRepository reports;

    @Autowired
    AdminActionRepository adminActions;

    @Autowired
    NotificationOutboxRepository notificationOutbox;

    @Autowired
    ListingPhotoRepository listingPhotos;

    private void stubToken(String uid, String email) throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(email);
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);
    }

    private User admin(String suffix) throws Exception {
        String uid = "uid-admin-" + suffix + "-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email);
        User admin = new User(uid, email, true, "Admin " + suffix);
        admin.setRole(UserRole.ADMIN);
        return users.saveAndFlush(admin);
    }

    private User regular(String suffix) throws Exception {
        String uid = "uid-plain-" + suffix + "-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email);
        return users.saveAndFlush(new User(uid, email, true, "Plain " + suffix));
    }

    private Listing listingFor(User owner, ListingStatus status) {
        return listings.saveAndFlush(new Listing(
                owner,
                "Studio modération " + System.nanoTime(),
                "Rabat",
                "Agdal",
                33.9716,
                -6.8498,
                new BigDecimal("2500.00"),
                status,
                AvailabilityState.AVAILABLE));
    }

    // --- role gating ---------------------------------------------------------

    @Test
    @DisplayName("anonymous callers are refused by the security chain on every admin route")
    void anonymousCallersAreRefused() {
        given().when().get("/admin/dashboard")
                .then().statusCode(401)
                .header("WWW-Authenticate", "Bearer")
                .body("code", equalTo("UNAUTHENTICATED"));

        given().when().get("/admin/reports").then().statusCode(401);
        given().when().get("/admin/users").then().statusCode(401);

        // A destructive route, because that is the one where a gap would matter.
        given().contentType("application/json").body("{\"reason\":\"spam\"}")
                .when().post("/admin/users/{id}/ban", UUID.randomUUID())
                .then().statusCode(401);
    }

    @Test
    @DisplayName("an authenticated non-admin is refused with the error envelope, not an empty 403")
    void nonAdminIsForbidden() throws Exception {
        regular("forbidden");

        given().header("Authorization", "Bearer plain-token")
                .when().get("/admin/dashboard")
                .then().statusCode(403)
                .body("code", equalTo("FORBIDDEN"));

        given().header("Authorization", "Bearer plain-token")
                .when().get("/admin/users")
                .then().statusCode(403);

        given().header("Authorization", "Bearer plain-token")
                .when().post("/admin/users/{id}/suspend", UUID.randomUUID())
                .then().statusCode(403);
    }

    @Test
    @DisplayName("a non-admin cannot approve a listing even when it is queued for review")
    void nonAdminCannotApprove() throws Exception {
        User owner = users.saveAndFlush(new User(
                "uid-owner-approve-" + System.nanoTime(), "owner-approve@example.ma", true, "Owner"));
        Listing pending = listingFor(owner, ListingStatus.PENDING_REVIEW);

        regular("approver");

        given().header("Authorization", "Bearer plain-token")
                .when().post("/admin/listings/{id}/approve", pending.getId())
                .then().statusCode(403);

        // The decisive assertion: refused, and the listing did not move.
        assertThat(listings.findById(pending.getId()).orElseThrow().getStatus())
                .isEqualTo(ListingStatus.PENDING_REVIEW);
    }

    // --- listing review ------------------------------------------------------

    @Test
    @DisplayName("the moderation queue carries each listing's cover photo")
    void queueCarriesCoverPhoto() throws Exception {
        User owner = users.saveAndFlush(new User(
                "uid-owner-cover-" + System.nanoTime(), "owner-cover@example.ma", true, "Owner"));
        Listing pending = listingFor(owner, ListingStatus.PENDING_REVIEW);
        listingPhotos.saveAndFlush(new ListingPhoto(
                pending, "listings/" + pending.getId() + "/cover.jpg", "image/jpeg", 1600, 1200, 0, true));

        admin("cover");

        // The queue used to return no cover at all -- coverPhotoUrl lived only on
        // PublicListingResponse -- so the console showed its placeholder and a
        // moderator decided approve-or-reject without ever seeing the photograph,
        // which is the single most likely thing to be wrong with a listing.
        given().header("Authorization", "Bearer admin-token")
                .when().get("/admin/listings")
                .then().statusCode(200)
                .body("find { it.id == '" + pending.getId() + "' }.coverPhotoUrl",
                        equalTo("/uploads/listings/" + pending.getId() + "/cover.jpg"));
    }

    @Test
    @DisplayName("a listing with no photo reports a null cover rather than omitting the field")
    void queueReportsNullCoverForListingWithoutPhoto() throws Exception {
        User owner = users.saveAndFlush(new User(
                "uid-owner-nocover-" + System.nanoTime(), "owner-nocover@example.ma", true, "Owner"));
        Listing pending = listingFor(owner, ListingStatus.PENDING_REVIEW);

        admin("nocover");

        // The key has to be present and null, not absent: the web client declares
        // these fields `T | null` and guards them, and an omitted key arrives as
        // undefined, which slipped past a `!== null` check and rendered an empty
        // value. spring.jackson.default-property-inclusion is `always` for this.
        given().header("Authorization", "Bearer admin-token")
                .when().get("/admin/listings")
                .then().statusCode(200)
                .body("find { it.id == '" + pending.getId() + "' }", hasKey("coverPhotoUrl"))
                .body("find { it.id == '" + pending.getId() + "' }.coverPhotoUrl", nullValue());
    }

    @Test
    @DisplayName("admin approves a pending listing and the decision is written to the audit log")
    void adminApprovesListing() throws Exception {
        User owner = users.saveAndFlush(new User(
                "uid-owner-ok-" + System.nanoTime(), "owner-ok@example.ma", true, "Owner"));
        Listing pending = listingFor(owner, ListingStatus.PENDING_REVIEW);

        User admin = admin("approve");
        long auditBefore = adminActions.count();

        given().header("Authorization", "Bearer admin-token")
                .when().post("/admin/listings/{id}/approve", pending.getId())
                .then().statusCode(200)
                .body("status", equalTo("PUBLISHED"));

        Listing approved = listings.findById(pending.getId()).orElseThrow();
        assertThat(approved.getStatus()).isEqualTo(ListingStatus.PUBLISHED);
        assertThat(approved.getRejectionReason()).isNull();

        assertThat(adminActions.count()).isEqualTo(auditBefore + 1);
        assertThat(adminActions.findAll().stream()
                .anyMatch(a -> a.getTargetId().equals(pending.getId())
                        && "APPROVE_LISTING".equals(a.getAction())
                        && a.getAdmin().getId().equals(admin.getId())))
                .isTrue();
    }

    @Test
    @DisplayName("admin rejects a pending listing with a reason the owner can act on")
    void adminRejectsListingWithReason() throws Exception {
        User owner = users.saveAndFlush(new User(
                "uid-owner-rej-" + System.nanoTime(), "owner-rej@example.ma", true, "Owner"));
        Listing pending = listingFor(owner, ListingStatus.PENDING_REVIEW);

        admin("reject");

        given().header("Authorization", "Bearer admin-token")
                .contentType("application/json")
                .body("{\"reason\":\"Les photos ne correspondent pas au logement\"}")
                .when().post("/admin/listings/{id}/reject", pending.getId())
                .then().statusCode(200)
                .body("status", equalTo("REJECTED"));

        Listing rejected = listings.findById(pending.getId()).orElseThrow();
        assertThat(rejected.getStatus()).isEqualTo(ListingStatus.REJECTED);
        // The owner has to be able to fix what was wrong; a rejection with no
        // reason is why the REJECTED -> PENDING_REVIEW loop would stall.
        assertThat(rejected.getRejectionReason()).isEqualTo("Les photos ne correspondent pas au logement");
    }

    @Test
    @DisplayName("approving a listing that is not pending review is an illegal transition")
    void approvingNonPendingListingIsRejected() throws Exception {
        User owner = users.saveAndFlush(new User(
                "uid-owner-draft-" + System.nanoTime(), "owner-draft@example.ma", true, "Owner"));
        Listing draft = listingFor(owner, ListingStatus.DRAFT);

        admin("illegal");

        given().header("Authorization", "Bearer admin-token")
                .when().post("/admin/listings/{id}/approve", draft.getId())
                .then().statusCode(409)
                .body("code", equalTo("ILLEGAL_TRANSITION"));

        assertThat(listings.findById(draft.getId()).orElseThrow().getStatus())
                .isEqualTo(ListingStatus.DRAFT);
    }

    // --- reports -------------------------------------------------------------

    @Test
    @DisplayName("WARN and DISMISS report actions resolve a listing report")
    void warnAndDismissReportActionsResolveReports() throws Exception {
        User owner = users.saveAndFlush(new User(
                "uid-owner-act-" + System.nanoTime(), "owner-act@example.ma", true, "Owner"));
        Listing listing = listingFor(owner, ListingStatus.PUBLISHED);
        User reporter = users.saveAndFlush(new User(
                "uid-reporter-act-" + System.nanoTime(), "reporter-act@example.ma", true, "Reporter"));
        reports.saveAndFlush(Report.create(reporter, new CreateReportRequest(
                ReportTarget.LISTING, listing.getId(), ReportReason.FAKE_LISTING, "Douteux")));

        admin("action");

        // WARN resolves the report and queues the owner notification.
        given().header("Authorization", "Bearer admin-token")
                .contentType("application/json")
                .body("{\"action\":\"WARN\",\"reason\":\"test\"}")
                .when().post("/admin/reports/{type}/{id}/action", "LISTING", listing.getId())
                .then().statusCode(200)
                .body("status", equalTo("ok"));

        given().header("Authorization", "Bearer admin-token")
                .contentType("application/json")
                .body("{\"action\":\"DISMISS\",\"reason\":\"Signalement infondé\"}")
                .when().post("/admin/reports/{type}/{id}/action", "LISTING", listing.getId())
                .then().statusCode(200)
                .body("status", equalTo("ok"));

        assertThat(reports.findByTargetTypeAndTargetIdAndStatus(
                ReportTarget.LISTING, listing.getId(), ReportStatus.PENDING)).isEmpty();
    }

    @Test
    @DisplayName("SUSPEND on a reported listing takes it down and closes the reports as acted on")
    void suspendActionOnListing() throws Exception {
        User owner = users.saveAndFlush(new User(
                "uid-susp-owner-" + System.nanoTime(), "susp-owner-" + System.nanoTime() + "@example.ma",
                true, "Owner"));
        Listing listing = listingFor(owner, ListingStatus.PUBLISHED);
        User reporter = users.saveAndFlush(new User(
                "uid-susp-rep-" + System.nanoTime(), "susp-rep-" + System.nanoTime() + "@example.ma",
                true, "Reporter"));
        reports.saveAndFlush(Report.create(reporter, new CreateReportRequest(
                ReportTarget.LISTING, listing.getId(), ReportReason.SUSPECTED_SCAM, "Arnaque")));

        admin("suspend-listing");

        given().header("Authorization", "Bearer admin-token")
                .contentType("application/json")
                .body("{\"action\":\"SUSPEND\",\"reason\":\"Contenu frauduleux\"}")
                .when().post("/admin/reports/{type}/{id}/action", "LISTING", listing.getId())
                .then().statusCode(200);

        Listing suspended = listings.findById(listing.getId()).orElseThrow();
        assertThat(suspended.getStatus()).isEqualTo(ListingStatus.SUSPENDED);
        // A moderator's decision is not the system's: leaving autoFlagged false
        // stops a later DISMISS from silently republishing it.
        assertThat(suspended.isAutoFlagged()).isFalse();
        assertThat(suspended.getPriorStatus()).isEqualTo(ListingStatus.PUBLISHED);

        assertThat(reports.findByTargetTypeAndTargetIdAndStatus(
                ReportTarget.LISTING, listing.getId(), ReportStatus.PENDING)).isEmpty();
        assertThat(reports.findByTargetTypeAndTargetIdAndStatus(
                ReportTarget.LISTING, listing.getId(), ReportStatus.ACTION_TAKEN)).hasSize(1);
    }

    @Test
    @DisplayName("a dismissal does not undo a suspension a moderator chose")
    void dismissDoesNotUndoDeliberateSuspension() throws Exception {
        User owner = users.saveAndFlush(new User(
                "uid-nodo-owner-" + System.nanoTime(), "nodo-owner-" + System.nanoTime() + "@example.ma",
                true, "Owner"));
        Listing listing = listingFor(owner, ListingStatus.PUBLISHED);
        User reporter = users.saveAndFlush(new User(
                "uid-nodo-rep-" + System.nanoTime(), "nodo-rep-" + System.nanoTime() + "@example.ma",
                true, "Reporter"));
        reports.saveAndFlush(Report.create(reporter, new CreateReportRequest(
                ReportTarget.LISTING, listing.getId(), ReportReason.FAKE_LISTING, "Faux")));

        admin("nodo");

        given().header("Authorization", "Bearer admin-token")
                .contentType("application/json")
                .body("{\"action\":\"SUSPEND\",\"reason\":\"Retire par la moderation\"}")
                .when().post("/admin/reports/{type}/{id}/action", "LISTING", listing.getId())
                .then().statusCode(200);

        User second = users.saveAndFlush(new User(
                "uid-nodo-rep2-" + System.nanoTime(), "nodo-rep2-" + System.nanoTime() + "@example.ma",
                true, "Reporter 2"));
        reports.saveAndFlush(Report.create(second, new CreateReportRequest(
                ReportTarget.LISTING, listing.getId(), ReportReason.OTHER, "Autre")));

        given().header("Authorization", "Bearer admin-token")
                .contentType("application/json")
                .body("{\"action\":\"DISMISS\",\"reason\":\"Infonde\"}")
                .when().post("/admin/reports/{type}/{id}/action", "LISTING", listing.getId())
                .then().statusCode(200);

        assertThat(listings.findById(listing.getId()).orElseThrow().getStatus())
                .isEqualTo(ListingStatus.SUSPENDED);
    }

    @Test
    @DisplayName("BAN is refused on a listing target, and WARN notifies its owner")
    void banOnListingRefusedAndWarnNotifiesOwner() throws Exception {
        User owner = users.saveAndFlush(new User(
                "uid-warn-owner-" + System.nanoTime(), "warn-owner-" + System.nanoTime() + "@example.ma",
                true, "Owner"));
        Listing listing = listingFor(owner, ListingStatus.PUBLISHED);
        User reporter = users.saveAndFlush(new User(
                "uid-warn-reporter-" + System.nanoTime(), "warn-reporter-" + System.nanoTime() + "@example.ma",
                true, "Reporter"));
        reports.saveAndFlush(Report.create(reporter, new CreateReportRequest(
                ReportTarget.LISTING, listing.getId(), ReportReason.OTHER, "A verifier")));

        admin("warn");

        given().header("Authorization", "Bearer admin-token")
                .contentType("application/json")
                .body("{\"action\":\"BAN\",\"reason\":\"x\"}")
                .when().post("/admin/reports/{type}/{id}/action", "LISTING", listing.getId())
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"));

        given().header("Authorization", "Bearer admin-token")
                .contentType("application/json")
                .body("{\"action\":\"WARN\",\"reason\":\"Veuillez verifier votre annonce\"}")
                .when().post("/admin/reports/{type}/{id}/action", "LISTING", listing.getId())
                .then().statusCode(200)
                .body("status", equalTo("ok"));

        NotificationOutbox warning = notificationOutbox.findAll().stream()
                .filter(event -> event.getEventType().equals("USER_WARNED")
                        && event.getRecipientId().equals(owner.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(warning.getRecipientId()).isEqualTo(owner.getId());
        assertThat(warning.getPayload()).isEqualTo("Veuillez verifier votre annonce");
        assertThat(reports.findByTargetTypeAndTargetIdAndStatus(
                ReportTarget.LISTING, listing.getId(), ReportStatus.PENDING)).isEmpty();
        assertThat(reports.findByTargetTypeAndTargetIdAndStatus(
                ReportTarget.LISTING, listing.getId(), ReportStatus.ACTION_TAKEN)).hasSize(1);

        given().header("Authorization", "Bearer admin-token")
                .contentType("application/json")
                .body("{\"action\":\"NONSENSE\"}")
                .when().post("/admin/reports/{type}/{id}/action", "LISTING", listing.getId())
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("the queue names its target and carries the reporters' dismissal history")
    void queueCarriesLabelAndReporterHistory() throws Exception {
        User owner = users.saveAndFlush(new User(
                "uid-label-owner-" + System.nanoTime(), "label-owner-" + System.nanoTime() + "@example.ma",
                true, "Owner"));
        Listing listing = listingFor(owner, ListingStatus.PUBLISHED);
        User reporter = users.saveAndFlush(new User(
                "uid-label-rep-" + System.nanoTime(), "label-rep-" + System.nanoTime() + "@example.ma",
                true, "Crying Wolf"));

        // One already-dismissed report from this reporter, then a live one.
        Report earlier = Report.create(reporter, new CreateReportRequest(
                ReportTarget.LISTING, listing.getId(), ReportReason.OTHER, "Ancien"));
        earlier.setStatus(ReportStatus.DISMISSED);
        reports.saveAndFlush(earlier);
        reports.saveAndFlush(Report.create(reporter, new CreateReportRequest(
                ReportTarget.LISTING, listing.getId(), ReportReason.FAKE_LISTING, "Nouveau")));

        admin("label");

        var queue = given().header("Authorization", "Bearer admin-token")
                .when().get("/admin/reports")
                .then().statusCode(200)
                .extract().jsonPath().getList("", java.util.Map.class);

        var row = queue.stream()
                .filter(item -> listing.getId().toString().equals(item.get("targetId")))
                .findFirst()
                .orElseThrow(() -> new AssertionError("listing missing from the report queue"));

        assertThat(row.get("targetLabel")).isEqualTo(listing.getTitle());
        assertThat(((Number) row.get("priorDismissedReports")).longValue()).isEqualTo(1L);
    }

    @Test
    @DisplayName("admin can look up a single user by id")
    void adminSingleUserLookup() throws Exception {
        User target = users.saveAndFlush(new User(
                "uid-lookup-" + System.nanoTime(), "lookup-" + System.nanoTime() + "@example.ma",
                true, "Looked Up"));

        admin("lookup");

        given().header("Authorization", "Bearer admin-token")
                .when().get("/admin/users/{id}", target.getId())
                .then().statusCode(200)
                .body("displayName", equalTo("Looked Up"));

        given().header("Authorization", "Bearer admin-token")
                .when().get("/admin/users/{id}", UUID.randomUUID())
                .then().statusCode(404);
    }

    // --- users ---------------------------------------------------------------

    @Test
    @DisplayName("admin ban over HTTP cascades to listings and blocks re-registration")
    void adminBanCascades() throws Exception {
        User target = users.saveAndFlush(new User(
                "uid-ban-target-" + System.nanoTime(), "ban-target-" + System.nanoTime() + "@example.ma",
                true, "Ban Target"));
        Listing owned = listingFor(target, ListingStatus.PUBLISHED);

        admin("ban");

        given().header("Authorization", "Bearer admin-token")
                .contentType("application/json")
                .body("{\"reason\":\"Conduite frauduleuse\"}")
                .when().post("/admin/users/{id}/ban", target.getId())
                .then().statusCode(200)
                .body("status", equalTo("ok"));

        assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.BANNED);
        // A banned owner's listings must not stay in public search.
        assertThat(listings.findById(owned.getId()).orElseThrow().getStatus())
                .isNotEqualTo(ListingStatus.PUBLISHED);
    }

    @Test
    @DisplayName("admin suspend is reversible and recorded, and a missing user is a 404")
    void adminSuspendAndMissingUser() throws Exception {
        User target = users.saveAndFlush(new User(
                "uid-susp-target-" + System.nanoTime(), "susp-target-" + System.nanoTime() + "@example.ma",
                true, "Suspend Target"));

        admin("suspend");

        given().header("Authorization", "Bearer admin-token")
                .when().post("/admin/users/{id}/suspend", target.getId())
                .then().statusCode(200);

        assertThat(users.findById(target.getId()).orElseThrow().getStatus()).isEqualTo(UserStatus.SUSPENDED);

        given().header("Authorization", "Bearer admin-token")
                .when().post("/admin/users/{id}/suspend", UUID.randomUUID())
                .then().statusCode(404)
                .body("code", equalTo("NOT_FOUND"));
    }

    // --- dashboard -----------------------------------------------------------

    @Test
    @DisplayName("dashboard returns the two counts the console renders")
    void dashboardReturnsCounts() throws Exception {
        admin("dashboard");

        given().header("Authorization", "Bearer admin-token")
                .when().get("/admin/dashboard")
                .then().statusCode(200)
                .body("pendingReviews", org.hamcrest.Matchers.notNullValue())
                .body("pendingReports", org.hamcrest.Matchers.notNullValue());
    }
}
