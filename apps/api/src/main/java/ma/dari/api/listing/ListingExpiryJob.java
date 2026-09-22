package ma.dari.api.listing;

import ma.dari.api.notification.NotificationService;
import io.micrometer.core.instrument.MeterRegistry;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Nightly: warns owners before a published listing's {@code expires_at}, then
 * expires the ones past it (rules in {@link ListingExpiry}).
 */
@Component
public class ListingExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(ListingExpiryJob.class);

    private final ListingRepository listings;
    private final ListingExpiry expiry;
    private final NotificationService notifications;
    private final MeterRegistry meterRegistry;

    public ListingExpiryJob(ListingRepository listings, ListingExpiry expiry,
                            NotificationService notifications, MeterRegistry meterRegistry) {
        this.listings = listings;
        this.expiry = expiry;
        this.notifications = notifications;
        this.meterRegistry = meterRegistry;
    }

    /**
     * Returns nothing on purpose. ShedLock cannot lock a method that returns a
     * primitive: when this returned {@code int}, every call, the scheduled one
     * included, threw LockingNotSupportedException before doing any work.
     *
     * <p>One transaction: each warning or expiry commits together with its
     * notification in the outbox, and the listings notified as expired are
     * exactly the ones expired, because both come from the same locked rows.
     */
    @Scheduled(cron = "${dari.listing.expiry-cron:0 0 2 * * *}", zone = "UTC")
    @SchedulerLock(name = "listingExpiryJob", lockAtMostFor = "PT10M", lockAtLeastFor = "PT1M")
    @Transactional
    public void expirePublishedListings() {
        Instant now = expiry.now();

        int windowsStarted = listings.startMissingExpiryWindows(
                ListingStatus.PUBLISHED, now.plus(expiry.expiryDays(), ChronoUnit.DAYS));
        if (windowsStarted > 0) {
            log.warn("Started an expiry window for {} published listings that had none", windowsStarted);
        }

        List<Listing> expiringSoon = listings.findToWarnOfExpiry(
                ListingStatus.PUBLISHED, now, now.plus(expiry.warningDays(), ChronoUnit.DAYS));
        for (Listing listing : expiringSoon) {
            notifications.listingExpiringSoon(listing, daysLeft(listing, now));
            listing.setExpiryWarnedAt(now);
        }
        meterRegistry.counter("dari.jobs.listing_expiry.warned").increment(expiringSoon.size());

        List<Listing> due = listings.findDueForExpiry(ListingStatus.PUBLISHED, now);
        for (Listing listing : due) {
            listing.setStatus(ListingStatus.EXPIRED);
            notifications.listingExpired(listing);
        }
        meterRegistry.counter("dari.jobs.listing_expiry.expired").increment(due.size());
        meterRegistry.counter("dari.jobs.listing_expiry.runs").increment();
    }

    /** Whole days until expiry, rounded up, as the warning email states them. */
    private static int daysLeft(Listing listing, Instant now) {
        long minutes = Duration.between(now, listing.getExpiresAt()).toMinutes();
        return (int) Math.max(1, (minutes + 1439) / 1440);
    }
}
