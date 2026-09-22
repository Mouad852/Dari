package ma.dari.api.listing;

import com.google.firebase.auth.FirebaseToken;
import io.micrometer.core.instrument.MeterRegistry;
import ma.dari.api.moderation.AdminService;
import ma.dari.api.moderation.ModerationAction;
import ma.dari.api.moderation.ReportTarget;
import ma.dari.api.support.AbstractJobIntegrationTest;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import ma.dari.api.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Listing expiry against the real database, with the Spring proxies (ShedLock,
 * transactions) and the entity callbacks that a Mockito test cannot see.
 *
 * <p>The job runs over every row in the shared database, so each scenario is
 * placed in the past and ends near the real time: listings belonging to other
 * test classes then never become due. This class soft-deletes its own
 * listings after each test for the same reason.
 */
class ListingExpiryIntegrationTest extends AbstractJobIntegrationTest {

    private static final Duration DAY = Duration.ofDays(1);

    @Autowired ListingExpiryJob job;
    @Autowired AdminService adminService;
    @Autowired ListingRepository listings;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired MeterRegistry meters;

    private final List<UUID> created = new ArrayList<>();

    @AfterEach
    void retireThisTestsListings() {
        for (UUID id : created) {
            jdbc.update("UPDATE listings SET deleted_at = now() WHERE id = ? AND deleted_at IS NULL", id);
        }
    }

    @Test
    void aWarnedListingExpiresOnItsDateAndRenewalStartsAFreshLife() {
        Instant approvedAt = startAt(Instant.now().minus(Duration.ofDays(60)));
        User owner = owner();
        UUID id = pendingListing(owner);

        adminService.approveListing(admin(), id);
        assertThat(expiresAt(id)).isEqualTo(approvedAt.plus(Duration.ofDays(60)));
        assertThat(warnedAt(id)).isNull();

        clock.set(approvedAt.plus(Duration.ofDays(54)));
        runJob();
        assertThat(status(id)).isEqualTo("PUBLISHED");
        assertThat(warnedAt(id)).isEqualTo(approvedAt.plus(Duration.ofDays(54)));
        assertThat(expiresAt(id)).as("the warning does not move the date").isEqualTo(approvedAt.plus(Duration.ofDays(60)));
        assertThat(outbox("LISTING_EXPIRING_SOON", id)).containsExactly("Votre annonce expire dans 6 jours");

        clock.set(approvedAt.plus(Duration.ofDays(55)));
        runJob();
        assertThat(outbox("LISTING_EXPIRING_SOON", id)).as("warned once, not every night").hasSize(1);

        clock.set(approvedAt.plus(Duration.ofDays(60)));
        runJob();
        assertThat(status(id)).isEqualTo("EXPIRED");
        assertThat(outbox("LISTING_EXPIRED", id)).containsExactly("Votre annonce a expiré et doit être renouvelée");

        clock.advance(Duration.ofHours(1));
        runJob();
        assertThat(outbox("LISTING_EXPIRED", id)).as("expired once").hasSize(1);

        // Renewal re-enters review (ListingStatus); approval starts the new life.
        stubToken(owner);
        given().header("Authorization", "Bearer owner").when().post("/listings/{id}/renew", id)
                .then().statusCode(200);
        assertThat(status(id)).isEqualTo("PENDING_REVIEW");
        assertThat(warnedAt(id)).isNull();

        Instant reapprovedAt = approvedAt.plus(Duration.ofDays(61));
        clock.set(reapprovedAt);
        adminService.approveListing(admin(), id);
        assertThat(status(id)).isEqualTo("PUBLISHED");
        assertThat(expiresAt(id)).isEqualTo(reapprovedAt.plus(Duration.ofDays(60)));
    }

    @Test
    void availabilityChangesAndOtherWritesDoNotMoveTheDate() {
        Instant approvedAt = startAt(Instant.now().minus(Duration.ofDays(10)));
        User owner = owner();
        UUID id = pendingListing(owner);
        adminService.approveListing(admin(), id);
        Instant expiresAt = expiresAt(id);
        Instant updatedBefore = updatedAt(id);

        stubToken(owner);
        given().header("Authorization", "Bearer owner").when().post("/listings/{id}/mark-room-found", id)
                .then().statusCode(200);
        given().header("Authorization", "Bearer owner").when().post("/listings/{id}/reopen", id)
                .then().statusCode(200);
        clock.set(approvedAt.plus(DAY));
        runJob();

        assertThat(updatedAt(id)).as("the row-audit column moves on every write").isAfter(updatedBefore);
        assertThat(expiresAt(id)).isEqualTo(expiresAt);
        assertThat(status(id)).isEqualTo("PUBLISHED");
    }

    @Test
    void reapprovalAfterAnEditStartsAFreshWindowAndClearsTheWarning() {
        Instant approvedAt = startAt(Instant.now().minus(Duration.ofDays(60)));
        User owner = owner();
        UUID id = pendingListing(owner);
        adminService.approveListing(admin(), id);
        clock.set(approvedAt.plus(Duration.ofDays(54)));
        runJob();
        assertThat(warnedAt(id)).isNotNull();

        stubToken(owner);
        given().header("Authorization", "Bearer owner").contentType("application/json")
                .body("{\"title\": \"Chambre lumineuse, titre corrigé\"}")
                .when().patch("/listings/{id}", id)
                .then().statusCode(200);
        assertThat(status(id)).isEqualTo("PENDING_REVIEW");

        // In review on its old date: the job leaves it alone.
        clock.set(approvedAt.plus(Duration.ofDays(60)));
        runJob();
        assertThat(status(id)).isEqualTo("PENDING_REVIEW");
        assertThat(outbox("LISTING_EXPIRED", id)).isEmpty();

        adminService.approveListing(admin(), id);
        assertThat(expiresAt(id)).isEqualTo(approvedAt.plus(Duration.ofDays(120)));
        assertThat(warnedAt(id)).isNull();
    }

    @Test
    void restoringASuspendedListingKeepsItsDate() {
        Instant approvedAt = startAt(Instant.now().minus(Duration.ofDays(20)));
        UUID id = pendingListing(owner());
        User admin = admin();
        adminService.approveListing(admin, id);
        autoSuspend(id);

        clock.set(approvedAt.plus(Duration.ofDays(10)));
        adminService.actOnReports(admin, ReportTarget.LISTING, id, ModerationAction.DISMISS, "Signalements infondés");

        assertThat(status(id)).isEqualTo("PUBLISHED");
        assertThat(expiresAt(id)).isEqualTo(approvedAt.plus(Duration.ofDays(60)));
    }

    @Test
    void aListingRestoredPastItsDateExpiresOnTheNextRun() {
        Instant approvedAt = startAt(Instant.now().minus(Duration.ofDays(70)));
        UUID id = pendingListing(owner());
        User admin = admin();
        adminService.approveListing(admin, id);
        autoSuspend(id);

        clock.set(approvedAt.plus(Duration.ofDays(65)));
        adminService.actOnReports(admin, ReportTarget.LISTING, id, ModerationAction.DISMISS, "Signalements infondés");
        assertThat(status(id)).isEqualTo("PUBLISHED");
        runJob();

        assertThat(status(id)).isEqualTo("EXPIRED");
        assertThat(outbox("LISTING_EXPIRED", id)).hasSize(1);
    }

    @Test
    void theListingsNotifiedAsExpiredAreExactlyTheOnesExpired() {
        Instant now = startAt(Instant.now());
        User owner = owner();
        User admin = admin();
        clock.set(now.minus(Duration.ofDays(61)));
        UUID due = approved(pendingListing(owner), admin);
        UUID alsoDue = approved(pendingListing(owner), admin);
        clock.set(now.minus(Duration.ofDays(59)));
        UUID soon = approved(pendingListing(owner), admin);
        clock.set(now);
        double expiredBefore = meters.counter("dari.jobs.listing_expiry.expired").count();
        long notifiedBefore = allOutbox("LISTING_EXPIRED");

        runJob();

        assertThat(status(due)).isEqualTo("EXPIRED");
        assertThat(status(alsoDue)).isEqualTo("EXPIRED");
        assertThat(status(soon)).isEqualTo("PUBLISHED");
        assertThat(outbox("LISTING_EXPIRED", due)).hasSize(1);
        assertThat(outbox("LISTING_EXPIRED", alsoDue)).hasSize(1);
        assertThat(outbox("LISTING_EXPIRED", soon)).isEmpty();
        assertThat(outbox("LISTING_EXPIRING_SOON", soon)).containsExactly("Votre annonce expire dans 1 jour");
        assertThat(meters.counter("dari.jobs.listing_expiry.expired").count() - expiredBefore)
                .isEqualTo(allOutbox("LISTING_EXPIRED") - notifiedBefore);
    }

    @Test
    void onlyLivePublishedListingsAreEverTouched() {
        Instant now = startAt(Instant.now());
        User owner = owner();
        List<UUID> untouchable = new ArrayList<>();
        for (ListingStatus status : List.of(ListingStatus.DRAFT, ListingStatus.PENDING_REVIEW,
                ListingStatus.REJECTED, ListingStatus.SUSPENDED, ListingStatus.EXPIRED)) {
            untouchable.add(listingWithDate(owner, status, now.minus(DAY), false));
            untouchable.add(listingWithDate(owner, status, now.plus(Duration.ofDays(2)), false));
        }
        untouchable.add(listingWithDate(owner, ListingStatus.PUBLISHED, now.minus(DAY), true));
        untouchable.add(listingWithDate(owner, ListingStatus.PUBLISHED, now.plus(Duration.ofDays(2)), true));
        List<String> statusesBefore = untouchable.stream().map(this::status).toList();
        List<Instant> datesBefore = untouchable.stream().map(this::expiresAt).toList();

        runJob();

        assertThat(untouchable.stream().map(this::status).toList()).isEqualTo(statusesBefore);
        assertThat(untouchable.stream().map(this::expiresAt).toList()).isEqualTo(datesBefore);
        for (UUID id : untouchable) {
            assertThat(warnedAt(id)).isNull();
            assertThat(outbox("LISTING_EXPIRING_SOON", id)).isEmpty();
            assertThat(outbox("LISTING_EXPIRED", id)).isEmpty();
        }
    }

    @Test
    void aPublishedListingWithoutADateGetsOneInsteadOfLivingForever() {
        Instant now = startAt(Instant.now());
        UUID id = track(listings.saveAndFlush(new Listing(owner(), "Approuvée par l'ancienne version", "Rabat",
                "Agdal", 33.9716, -6.8498, new BigDecimal("2400.00"), ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE)).getId());
        assertThat(expiresAt(id)).isNull();

        runJob();

        assertThat(expiresAt(id)).isEqualTo(now.plus(Duration.ofDays(60)));
        assertThat(status(id)).isEqualTo("PUBLISHED");
        assertThat(outbox("LISTING_EXPIRING_SOON", id)).isEmpty();
    }

    // --- helpers -----------------------------------------------------------

    /** Millisecond precision, so dates survive the round trip through timestamptz exactly. */
    private Instant startAt(Instant instant) {
        Instant start = instant.truncatedTo(ChronoUnit.MILLIS);
        clock.set(start);
        return start;
    }

    /**
     * Each call stands for a later night, so the previous run's lockAtLeastFor
     * of one minute is released first. lock_until is a timestamp without time
     * zone that ShedLock compares in UTC, so "now()" (local) would not do, and
     * a deleted row would not either: ShedLock remembers the row exists and
     * only ever updates it afterwards.
     */
    private void runJob() {
        jdbc.update("UPDATE shedlock SET lock_until = TIMESTAMP '2000-01-01 00:00:00' WHERE name = 'listingExpiryJob'");
        job.expirePublishedListings();
    }

    private User owner() {
        String uid = "uid-expiry-owner-" + System.nanoTime();
        return users.saveAndFlush(new User(uid, uid + "@example.ma", true, "Propriétaire Expiry"));
    }

    private User admin() {
        String uid = "uid-expiry-admin-" + System.nanoTime();
        User admin = new User(uid, uid + "@example.ma", true, "Modération Expiry");
        admin.setRole(UserRole.ADMIN);
        return users.saveAndFlush(admin);
    }

    private UUID pendingListing(User owner) {
        return track(listings.saveAndFlush(new Listing(owner, "Chambre à Agdal près du tram", "Rabat", "Agdal",
                33.9716, -6.8498, new BigDecimal("2500.00"), ListingStatus.PENDING_REVIEW,
                AvailabilityState.AVAILABLE)).getId());
    }

    private UUID approved(UUID id, User admin) {
        adminService.approveListing(admin, id);
        return id;
    }

    private UUID listingWithDate(User owner, ListingStatus status, Instant expiresAt, boolean softDeleted) {
        UUID id = track(listings.saveAndFlush(new Listing(owner, "Hors du périmètre de l'expiration", "Rabat",
                "Agdal", 33.9716, -6.8498, new BigDecimal("2300.00"), status, AvailabilityState.AVAILABLE)).getId());
        jdbc.update("UPDATE listings SET expires_at = ?, deleted_at = ? WHERE id = ?",
                Timestamp.from(expiresAt), softDeleted ? Timestamp.from(Instant.now()) : null, id);
        return id;
    }

    /** The state ReportService.autoSuspendTarget leaves: suspended by the report threshold. */
    private void autoSuspend(UUID id) {
        Listing listing = listings.findById(id).orElseThrow();
        listing.setPriorStatus(listing.getStatus());
        listing.setStatus(ListingStatus.SUSPENDED);
        listing.setAutoFlagged(true);
        listings.saveAndFlush(listing);
    }

    private UUID track(UUID id) {
        created.add(id);
        return id;
    }

    private void stubToken(User owner) {
        try {
            FirebaseToken token = Mockito.mock(FirebaseToken.class);
            Mockito.when(token.getUid()).thenReturn(owner.getFirebaseUid());
            Mockito.when(token.getEmail()).thenReturn(owner.getEmail());
            Mockito.when(token.isEmailVerified()).thenReturn(true);
            Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private String status(UUID id) {
        return jdbc.queryForObject("SELECT status::text FROM listings WHERE id = ?", String.class, id);
    }

    private Instant expiresAt(UUID id) {
        return instant("expires_at", id);
    }

    private Instant warnedAt(UUID id) {
        return instant("expiry_warned_at", id);
    }

    private Instant updatedAt(UUID id) {
        return instant("updated_at", id);
    }

    private Instant instant(String column, UUID id) {
        Timestamp value = jdbc.queryForObject("SELECT " + column + " FROM listings WHERE id = ?", Timestamp.class, id);
        return value == null ? null : value.toInstant();
    }

    private List<String> outbox(String eventType, UUID listingId) {
        return jdbc.queryForList("SELECT payload FROM notification_outbox WHERE event_type = ? AND aggregate_id = ? "
                + "ORDER BY created_at", String.class, eventType, listingId);
    }

    private long allOutbox(String eventType) {
        return jdbc.queryForObject("SELECT count(*) FROM notification_outbox WHERE event_type = ?", Long.class, eventType);
    }
}
