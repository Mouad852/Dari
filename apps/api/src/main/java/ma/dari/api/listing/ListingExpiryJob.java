package ma.dari.api.listing;

import ma.dari.api.notification.NotificationService;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
public class ListingExpiryJob {

    private final ListingRepository listings;
    private final Clock clock;
    private final int expiryDays;
    private final int warningDays;
    private final NotificationService notifications;

    public ListingExpiryJob(ListingRepository listings, Clock clock,
                            org.springframework.core.env.Environment environment,
                            NotificationService notifications) {
        this.listings = listings;
        this.clock = clock;
        this.expiryDays = environment.getProperty("dari.listing.expiry-days", Integer.class, 60);
        this.warningDays = environment.getProperty("dari.listing.expiry-warning-days", Integer.class, 7);
        this.notifications = notifications;
    }

    @Scheduled(cron = "${dari.listing.expiry-cron:0 0 2 * * *}", zone = "UTC")
    @SchedulerLock(name = "listingExpiryJob", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    @Transactional
    public int expirePublishedListings() {
        Instant now = Instant.now(clock);
        Instant cutoff = now.minus(expiryDays, ChronoUnit.DAYS);
        Instant warningCutoff = now.minus(expiryDays - warningDays, ChronoUnit.DAYS);
        var expiringSoon = listings.findExpiringSoon(ListingStatus.PUBLISHED, warningCutoff, cutoff);
        expiringSoon.forEach(listing -> {
            notifications.listingExpiringSoon(listing, warningDays);
            listing.setExpiryWarnedAt(now);
        });

        var eligible = listings.findByStatusAndUpdatedAtBeforeAndDeletedAtIsNull(
                ListingStatus.PUBLISHED, cutoff);
        int expired = listings.expirePublishedBefore(cutoff);
        if (expired > 0) {
            eligible.forEach(notifications::listingExpired);
        }
        return expired;
    }
}
