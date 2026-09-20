package ma.dari.api.config;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PostConstruct;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.media.MediaCleanupRepository;
import ma.dari.api.media.MediaCleanupStatus;
import ma.dari.api.moderation.ReportRepository;
import ma.dari.api.moderation.ReportStatus;
import ma.dari.api.notification.NotificationOutboxRepository;
import ma.dari.api.notification.NotificationOutboxStatus;
import org.springframework.context.annotation.Configuration;

/**
 * Registers the queue-depth gauges TODO.md's operations section calls for:
 * moderation queue depth and notification outbox depth. Each gauge is a
 * direct count query run at scrape time, not a value pushed on every write —
 * a moderator queue's size is exactly the kind of thing better read fresh
 * than tracked incrementally, since it can also shrink from outside this
 * process (a moderator acting through a different instance).
 *
 * <p>Search latency, report volume, job outcomes, and unhandled-error rate
 * are recorded at their call sites instead, since those are genuinely
 * point-in-time events rather than a queue size.
 */
@Configuration
public class MetricsConfig {

    private final MeterRegistry registry;
    private final ListingRepository listings;
    private final ReportRepository reports;
    private final NotificationOutboxRepository outbox;
    private final MediaCleanupRepository mediaCleanups;

    public MetricsConfig(MeterRegistry registry, ListingRepository listings,
                         ReportRepository reports, NotificationOutboxRepository outbox,
                         MediaCleanupRepository mediaCleanups) {
        this.registry = registry;
        this.listings = listings;
        this.reports = reports;
        this.outbox = outbox;
        this.mediaCleanups = mediaCleanups;
    }

    @PostConstruct
    void registerGauges() {
        Gauge.builder("dari.moderation.queue_depth", listings,
                        r -> r.countByStatusAndDeletedAtIsNull(ListingStatus.PENDING_REVIEW))
                .description("Listings awaiting moderator review")
                .tag("target", "listing")
                .register(registry);

        Gauge.builder("dari.moderation.queue_depth", reports,
                        r -> r.countByStatus(ReportStatus.PENDING))
                .description("Reports awaiting moderator review")
                .tag("target", "report")
                .register(registry);

        for (NotificationOutboxStatus status : NotificationOutboxStatus.values()) {
            Gauge.builder("dari.notifications.outbox_depth", outbox,
                            r -> r.countByStatus(status))
                    .description("Notification outbox rows by delivery state")
                    .tag("status", status.name())
                    .register(registry);
        }

        Gauge.builder("dari.media.cleanup_depth", mediaCleanups,
                        r -> r.countByStatus(MediaCleanupStatus.PENDING))
                .description("Media cleanup rows awaiting remote deletion")
                .tag("status", MediaCleanupStatus.PENDING.name())
                .register(registry);
        Gauge.builder("dari.media.cleanup_failures", mediaCleanups,
                        r -> r.countByStatusAndAttemptsGreaterThan(MediaCleanupStatus.PENDING, 0))
                .description("Media cleanup rows that have already failed and will be retried")
                .register(registry);
    }
}
