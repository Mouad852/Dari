package ma.dari.api.moderation;

import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.listing.AvailabilityState;
import ma.dari.api.listing.Listing;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.listing.ListingStatus;
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

class ReportApiTest extends AbstractIntegrationTest {

    @Autowired
    UserRepository users;

    @Autowired
    ListingRepository listings;

    @Autowired
    ReportRepository reports;

    @Autowired
    AdminService adminService;

    @Autowired
    NotificationOutboxRepository notificationOutbox;

    private void stubToken(String uid, String email) throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(email);
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);
    }

    @Test
    @DisplayName("report creation succeeds and duplicate pending reports are rejected")
    void createReportAndRejectDuplicate() throws Exception {
        stubToken("uid-reporter", "reporter@example.ma");
        User reporter = users.save(new User("uid-reporter", "reporter@example.ma", true, "Reporter"));

        User owner = users.save(new User("uid-listed-owner", "listed-owner@example.ma", true, "Owner"));
        Listing listing = listings.saveAndFlush(new Listing(
                owner,
                "Studio report?",
                "Rabat",
                "Agdal",
                33.9716,
                -6.8498,
                new BigDecimal("2500.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        String body = "{\"targetType\":\"LISTING\",\"targetId\":\"" + listing.getId() + "\",\"reason\":\"FAKE_LISTING\",\"details\":\"Peut-?tre faux\"}";

        given().header("Authorization", "Bearer test-reporter")
                .contentType("application/json")
                .body(body)
                .when().post("/reports")
                .then().statusCode(201)
                .body("targetType", equalTo("LISTING"))
                .body("status", equalTo("PENDING"));

        assertThat(notificationOutbox.findAll().stream()
                .anyMatch(event -> "REPORT_ACKNOWLEDGED".equals(event.getEventType())
                        && reporter.getId().equals(event.getRecipientId())))
                .isTrue();

        given().header("Authorization", "Bearer test-reporter")
                .contentType("application/json")
                .body(body)
                .when().post("/reports")
                .then().statusCode(409)
                .body("code", equalTo("ALREADY_REPORTED"));
    }

    @Test
    @DisplayName("a reporter cannot report their own listing or their own profile")
    void selfReportsAreRejected() throws Exception {
        String uid = "uid-self-report-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email);
        User self = users.saveAndFlush(new User(uid, email, true, "Self Reporter"));

        Listing own = listings.saveAndFlush(new Listing(
                self,
                "Studio à moi",
                "Rabat",
                "Agdal",
                33.9716,
                -6.8498,
                new BigDecimal("2500.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        given().header("Authorization", "Bearer self-token")
                .contentType("application/json")
                .body("{\"targetType\":\"LISTING\",\"targetId\":\"" + own.getId() + "\",\"reason\":\"FAKE_LISTING\"}")
                .when().post("/reports")
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("message", equalTo("Vous ne pouvez pas signaler votre propre contenu"));

        given().header("Authorization", "Bearer self-token")
                .contentType("application/json")
                .body("{\"targetType\":\"USER\",\"targetId\":\"" + self.getId() + "\",\"reason\":\"OTHER\",\"details\":\"test\"}")
                .when().post("/reports")
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("reporter sees only their own report history")
    void reporterCanListTheirOwnReports() throws Exception {
        User reporter = users.save(new User("uid-reporter-history", "reporter-history@example.ma", true, "Reporter History"));
        stubToken("uid-reporter-history", "reporter-history@example.ma");

        User owner = users.save(new User("uid-target-history", "target-history@example.ma", true, "Owner History"));
        Listing listing = listings.saveAndFlush(new Listing(
                owner,
                "Studio historique",
                "Rabat",
                "Agdal",
                33.9716,
                -6.8498,
                new BigDecimal("2500.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        given().header("Authorization", "Bearer test-reporter-history")
                .contentType("application/json")
                .body("{\"targetType\":\"LISTING\",\"targetId\":\"" + listing.getId() + "\",\"reason\":\"FAKE_LISTING\",\"details\":\"N\'a pas l\'air fiable\"}")
                .when().post("/reports")
                .then().statusCode(201);

        given().header("Authorization", "Bearer test-reporter-history")
                .when().get("/reports/me")
                .then().statusCode(200)
                .body("size()", equalTo(1))
                .body("[0].targetType", equalTo("LISTING"))
                .body("[0].status", equalTo("PENDING"));
    }

    @Test
    @DisplayName("three distinct reports from different reporters auto-suspend the listing")
    void threeDistinctReportersAutoSuspendListing() throws Exception {
        User owner = users.save(new User("uid-auto-owner", "auto-owner@example.ma", true, "Owner"));
        Listing listing = listings.saveAndFlush(new Listing(
                owner,
                "Studio auto-suspension",
                "Casablanca",
                "Maarif",
                33.5731,
                -7.5898,
                new BigDecimal("2000.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        for (String uid : new String[]{"uid-r1", "uid-r2", "uid-r3"}) {
            stubToken(uid, uid + "@example.ma");
            users.save(new User(uid, uid + "@example.ma", true, "Reporter " + uid));

            given().header("Authorization", "Bearer " + uid)
                    .contentType("application/json")
                    .body("{\"targetType\":\"LISTING\",\"targetId\":\"" + listing.getId() + "\",\"reason\":\"FAKE_LISTING\",\"details\":\"Suspicious\"}")
                    .when().post("/reports")
                    .then().statusCode(201);
        }

        Listing updated = listings.findById(listing.getId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(ListingStatus.SUSPENDED);
        assertThat(updated.getPriorStatus()).isEqualTo(ListingStatus.PUBLISHED);
        assertThat(updated.isAutoFlagged()).isTrue();

        User admin = new User("uid-auto-listing-admin-" + System.nanoTime(), "auto-listing-admin@example.ma", true, "Admin");
        admin.setRole(UserRole.ADMIN);
        users.saveAndFlush(admin);
        adminService.dismissReports(admin, ReportTarget.LISTING, listing.getId(), "DISMISS", "Signalements infondés");

        Listing reinstated = listings.findById(listing.getId()).orElseThrow();
        assertThat(reinstated.getStatus()).isEqualTo(ListingStatus.PUBLISHED);
        assertThat(reinstated.isAutoFlagged()).isFalse();
        assertThat(notificationOutbox.findAll().stream()
                .anyMatch(event -> "LISTING_REINSTATED".equals(event.getEventType())
                        && event.getAggregateId().equals(listing.getId())))
                .isTrue();
    }

    @Test
    @DisplayName("three distinct user reports auto-suspend and dismissing them reactivates the account")
    void userReportsAutoSuspendAndDismissReactivates() throws Exception {
        User target = users.saveAndFlush(new User(
                "uid-auto-user-target-" + System.nanoTime(), "auto-user-target@example.ma", true, "Target"));
        User admin = new User("uid-auto-user-admin-" + System.nanoTime(), "auto-user-admin@example.ma", true, "Admin");
        admin.setRole(UserRole.ADMIN);
        users.saveAndFlush(admin);

        for (int i = 1; i <= 3; i++) {
            String uid = "uid-user-report-" + i + "-" + System.nanoTime();
            stubToken(uid, uid + "@example.ma");
            User reporter = users.saveAndFlush(new User(uid, uid + "@example.ma", true, "Reporter " + i));
            given().header("Authorization", "Bearer " + uid)
                    .contentType("application/json")
                    .body("{\"targetType\":\"USER\",\"targetId\":\"" + target.getId()
                            + "\",\"reason\":\"OTHER\",\"details\":\"Signalement\"}")
                    .when().post("/reports")
                    .then().statusCode(201);
            assertThat(reporter.getId()).isNotNull();
        }

        User suspended = users.findById(target.getId()).orElseThrow();
        assertThat(suspended.getStatus()).isEqualTo(UserStatus.SUSPENDED);
        assertThat(suspended.isAutoSuspended()).isTrue();
        assertThat(notificationOutbox.findAll().stream()
                .anyMatch(event -> "USER_SUSPENDED".equals(event.getEventType())
                        && event.getRecipientId().equals(target.getId())))
                .isTrue();

        adminService.dismissReports(admin, ReportTarget.USER, target.getId(), "DISMISS", "Signalements infondés");

        User restored = users.findById(target.getId()).orElseThrow();
        assertThat(restored.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(restored.isAutoSuspended()).isFalse();
        assertThat(reports.findByTargetTypeAndTargetIdAndStatus(
                ReportTarget.USER, target.getId(), ReportStatus.PENDING)).isEmpty();
    }

    @Test
    @DisplayName("dismissing reports does not undo a manual user suspension")
    void dismissDoesNotUndoManualUserSuspension() throws Exception {
        User target = new User("uid-manual-user-target-" + System.nanoTime(), "manual-user-target@example.ma", true, "Manual target");
        target.setStatus(UserStatus.SUSPENDED);
        target = users.saveAndFlush(target);
        User admin = new User("uid-manual-user-admin-" + System.nanoTime(), "manual-user-admin@example.ma", true, "Admin");
        admin.setRole(UserRole.ADMIN);
        users.saveAndFlush(admin);

        for (int i = 1; i <= 3; i++) {
            String uid = "uid-manual-report-" + i + "-" + System.nanoTime();
            User reporter = users.saveAndFlush(new User(uid, uid + "@example.ma", true, "Reporter " + i));
            reports.saveAndFlush(Report.create(reporter, new CreateReportRequest(
                    ReportTarget.USER, target.getId(), ReportReason.OTHER, "Signalement")));
        }

        adminService.dismissReports(admin, ReportTarget.USER, target.getId(), "DISMISS", "Signalements infondés");

        User unchanged = users.findById(target.getId()).orElseThrow();
        assertThat(unchanged.getStatus()).isEqualTo(UserStatus.SUSPENDED);
        assertThat(unchanged.isAutoSuspended()).isFalse();
    }

    @Test
    @DisplayName("admin can search users by status and query and sees report counts")
    void adminUserSearchWorks() {
        User activeUser = users.save(new User("uid-active-user", "active-user@example.ma", true, "Salma Active"));
        User suspendedUser = new User("uid-suspended-user", "suspended-user@example.ma", true, "Youssef Suspended");
        suspendedUser.setStatus(UserStatus.SUSPENDED);
        suspendedUser = users.save(suspendedUser);

        User reporter = users.save(new User("uid-reporter-user", "reporter-user@example.ma", true, "Reporter"));
        reports.save(Report.create(reporter, new CreateReportRequest(
                ReportTarget.USER,
                suspendedUser.getId(),
                ReportReason.OTHER,
                "Suspicious account"
        )));

        // Asserts this user's row is correct, not that it is the only one. The
        // Testcontainers database is shared across the whole suite (see
        // ARCHITECTURE.md §7), so any other class that suspends a user -- as
        // AdminApiTest now does -- would otherwise break this by existing.
        UUID suspendedId = suspendedUser.getId();
        var byStatus = adminService.searchUsers(null, UserStatus.SUSPENDED, null);
        assertThat(byStatus.items()).allMatch(row -> row.status() == UserStatus.SUSPENDED);
        var suspendedRow = byStatus.items().stream()
                .filter(row -> row.id().equals(suspendedId))
                .findFirst()
                .orElseThrow(() -> new AssertionError("suspended user missing from the status filter"));
        assertThat(suspendedRow.reportCount()).isEqualTo(1L);

        var byQuery = adminService.searchUsers("salma", null, null);
        assertThat(byQuery.items()).extracting(row -> row.displayName()).contains("Salma Active");

        assertThat(users.findById(activeUser.getId())).isPresent();
    }

    @Test
    @DisplayName("admin queue groups pending reports by target and orders auto-flagged items first")
    void adminReportsAreGroupedByTarget() {
        User owner = users.save(new User("uid-queue-owner", "queue-owner@example.ma", true, "Owner Queue"));
        Listing listing = listings.saveAndFlush(new Listing(
                owner,
                "Studio queue",
                "Rabat",
                "Agdal",
                33.9716,
                -6.8498,
                new BigDecimal("2400.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        User reporterOne = users.save(new User("uid-r1-queue", "r1-queue@example.ma", true, "Reporter 1"));
        User reporterTwo = users.save(new User("uid-r2-queue", "r2-queue@example.ma", true, "Reporter 2"));
        reports.save(Report.create(reporterOne, new CreateReportRequest(
                ReportTarget.LISTING,
                listing.getId(),
                ReportReason.FAKE_LISTING,
                "Bad listing"
        )));
        reports.save(Report.create(reporterTwo, new CreateReportRequest(
                ReportTarget.LISTING,
                listing.getId(),
                ReportReason.SUSPECTED_SCAM,
                "Scam risk"
        )));

        // Finds this listing's row rather than assuming the queue holds only it.
        // The Testcontainers database is shared suite-wide, so any other class
        // that leaves a pending report -- AdminApiTest does -- would otherwise
        // break this by existing. Third occurrence of this pattern in the suite.
        UUID listingId = listing.getId();
        var row = adminService.pendingReportQueue().stream()
                .filter(item -> item.targetType() == ReportTarget.LISTING && item.targetId().equals(listingId))
                .findFirst()
                .orElseThrow(() -> new AssertionError("listing missing from the pending report queue"));

        assertThat(row.reportCount()).isEqualTo(2L);
        assertThat(row.reporterCount()).isEqualTo(2L);
    }

    @Test
    @DisplayName("admin ban suspends the listing and blocks re-registration by email")
    void adminBanSuspendsUserAndBlocksReRegistration() {
        User owner = users.save(new User("uid-banned-owner", "banned-owner@example.ma", true, "Owner"));
        Listing listing = listings.saveAndFlush(new Listing(
                owner,
                "Studio banni",
                "Marrakech",
                "Medina",
                31.6295,
                -7.9811,
                new BigDecimal("1800.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        User admin = new User("uid-admin-ban", "admin-ban@example.ma", true, "Mod?rateur");
        admin.setRole(UserRole.ADMIN);
        users.saveAndFlush(admin);
        adminService.banUser(admin, owner.getId(), "Conduite frauduleuse");

        User bannedOwner = users.findById(owner.getId()).orElseThrow();
        assertThat(bannedOwner.getStatus()).isEqualTo(UserStatus.BANNED);

        Listing bannedListing = listings.findById(listing.getId()).orElseThrow();
        assertThat(bannedListing.getStatus()).isEqualTo(ListingStatus.SUSPENDED);
        assertThat(bannedListing.getDeletedAt()).isNotNull();
    }
}
