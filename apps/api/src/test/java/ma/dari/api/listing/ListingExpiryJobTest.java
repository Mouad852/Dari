package ma.dari.api.listing;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.env.MockEnvironment;
import ma.dari.api.notification.NotificationService;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ListingExpiryJobTest {

    private static final Instant NOW = Instant.parse("2026-09-05T12:00:00Z");

    @Test
    void expiresPublishedListingsUsingConfiguredWindow() {
        ListingRepository listings = mock(ListingRepository.class);
        NotificationService notifications = mock(NotificationService.class);
        Listing first = mock(Listing.class);
        Listing second = mock(Listing.class);
        when(listings.findByStatusAndUpdatedAtBeforeAndDeletedAtIsNull(
            ListingStatus.PUBLISHED, Instant.parse("2026-07-07T12:00:00Z")))
            .thenReturn(java.util.List.of(first, second));
        when(listings.expirePublishedBefore(Instant.parse("2026-07-07T12:00:00Z"))).thenReturn(2);
        ListingExpiryJob job = job(listings, notifications);

        assertThat(job.expirePublishedListings()).isEqualTo(2);

        ArgumentCaptor<Instant> cutoff = ArgumentCaptor.forClass(Instant.class);
        verify(listings).expirePublishedBefore(cutoff.capture());
        assertThat(cutoff.getValue()).isEqualTo(Instant.parse("2026-07-07T12:00:00Z"));
        verify(notifications).listingExpired(first);
        verify(notifications).listingExpired(second);
    }

        @Test
        void warnsListingsInTheSevenDayWindowAndMarksThemAsWarned() {
        ListingRepository listings = mock(ListingRepository.class);
        NotificationService notifications = mock(NotificationService.class);
        Listing listing = mock(Listing.class);
        when(listings.findExpiringSoon(ListingStatus.PUBLISHED,
            Instant.parse("2026-07-14T12:00:00Z"),
            Instant.parse("2026-07-07T12:00:00Z")))
            .thenReturn(java.util.List.of(listing));
        when(listings.findByStatusAndUpdatedAtBeforeAndDeletedAtIsNull(
            ListingStatus.PUBLISHED, Instant.parse("2026-07-07T12:00:00Z")))
            .thenReturn(java.util.List.of());
        when(listings.expirePublishedBefore(Instant.parse("2026-07-07T12:00:00Z"))).thenReturn(0);
        ListingExpiryJob job = job(listings, notifications);

        assertThat(job.expirePublishedListings()).isZero();

        verify(notifications).listingExpiringSoon(listing, 7);
        verify(listing).setExpiryWarnedAt(NOW);
        }

        @Test
        void warningMarkerPreventsASecondWarning() {
        ListingRepository listings = mock(ListingRepository.class);
        NotificationService notifications = mock(NotificationService.class);
        when(listings.findExpiringSoon(ListingStatus.PUBLISHED,
            Instant.parse("2026-07-14T12:00:00Z"),
            Instant.parse("2026-07-07T12:00:00Z")))
            .thenReturn(java.util.List.of(), java.util.List.of());
        when(listings.findByStatusAndUpdatedAtBeforeAndDeletedAtIsNull(
            ListingStatus.PUBLISHED, Instant.parse("2026-07-07T12:00:00Z")))
            .thenReturn(java.util.List.of(), java.util.List.of());
        when(listings.expirePublishedBefore(Instant.parse("2026-07-07T12:00:00Z"))).thenReturn(0, 0);
        ListingExpiryJob job = job(listings, notifications);

        job.expirePublishedListings();
        job.expirePublishedListings();

        verify(notifications, org.mockito.Mockito.never())
            .listingExpiringSoon(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt());
        }

    @Test
    void secondRunIsIdempotentWhenNoPublishedListingsRemainEligible() {
        ListingRepository listings = mock(ListingRepository.class);
        NotificationService notifications = mock(NotificationService.class);
        when(listings.expirePublishedBefore(NOW.minusSeconds(60L * 24 * 60 * 60)))
                .thenReturn(2, 0);
        when(listings.findByStatusAndUpdatedAtBeforeAndDeletedAtIsNull(
            ListingStatus.PUBLISHED, NOW.minusSeconds(60L * 24 * 60 * 60)))
            .thenReturn(java.util.List.of(mock(Listing.class)), java.util.List.of());
        ListingExpiryJob job = job(listings, notifications);

        assertThat(job.expirePublishedListings()).isEqualTo(2);
        assertThat(job.expirePublishedListings()).isZero();
        verify(listings, org.mockito.Mockito.times(2)).expirePublishedBefore(NOW.minusSeconds(60L * 24 * 60 * 60));
        verify(notifications, org.mockito.Mockito.times(1)).listingExpired(org.mockito.ArgumentMatchers.any());
    }

    private ListingExpiryJob job(ListingRepository listings, NotificationService notifications) {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("dari.listing.expiry-days", "60");
        return new ListingExpiryJob(listings, Clock.fixed(NOW, ZoneOffset.UTC), environment, notifications);
    }
}
