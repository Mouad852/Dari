package ma.dari.api.notification;

import ma.dari.api.user.UserRepository;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;

@Service
@ConditionalOnProperty(name = "dari.notifications.enabled", havingValue = "true")
public class NotificationDeliveryService {

    private static final Set<String> EVENT_TYPES = Set.of(
            "LISTING_APPROVED", "LISTING_REJECTED", "LISTING_SUSPENDED",
            "LISTING_REINSTATED", "LISTING_EXPIRING_SOON", "LISTING_EXPIRED",
            "USER_WARNED", "USER_SUSPENDED", "USER_BANNED", "REPORT_ACKNOWLEDGED");

    private final NotificationOutboxClaimService claims;
    private final NotificationOutboxRepository outbox;
    private final UserRepository users;
    private final NotificationSender sender;
    private final Clock clock;
    private final int batchSize;
    private final int maxAttempts;
    private final Duration retryDelay;
    private final Duration staleAfter;
    private final MeterRegistry meterRegistry;

    public NotificationDeliveryService(NotificationOutboxClaimService claims,
                                       NotificationOutboxRepository outbox,
                                       UserRepository users,
                                       NotificationSender sender,
                                       Clock clock,
                                       org.springframework.core.env.Environment environment,
                                       MeterRegistry meterRegistry) {
        this.claims = claims;
        this.outbox = outbox;
        this.users = users;
        this.sender = sender;
        this.clock = clock;
        this.meterRegistry = meterRegistry;
        this.batchSize = environment.getProperty("dari.notifications.batch-size", Integer.class, 50);
        this.maxAttempts = environment.getProperty("dari.notifications.max-attempts", Integer.class, 5);
        this.retryDelay = Duration.ofSeconds(environment.getProperty(
                "dari.notifications.retry-delay-seconds", Integer.class, 60));
        this.staleAfter = Duration.ofMinutes(environment.getProperty(
                "dari.notifications.stale-after-minutes", Integer.class, 15));
    }

    @Scheduled(fixedDelayString = "${dari.notifications.delivery-interval-ms:30000}")
    public void deliverPending() {
        Instant now = Instant.now(clock);
        claims.claim(batchSize, now, now.minus(staleAfter))
                .forEach(event -> deliver(event, now));
    }

    private void deliver(NotificationOutbox event, Instant now) {
        String validationError = validate(event);
        if (validationError != null) {
            event.markDead(validationError);
            outbox.save(event);
            counter("dead").increment();
            return;
        }

        try {
            String email = users.findById(event.getRecipientId())
                    .map(user -> user.getEmail())
                    .orElse(null);
            if (email == null || email.isBlank()) {
                event.markDead("Recipient has no email address");
                counter("dead").increment();
            } else {
                sender.send(event, email);
                event.markSent(now);
                counter("sent").increment();
            }
        } catch (RuntimeException exception) {
            if (event.getAttempts() >= maxAttempts) {
                event.markDead("Delivery failed after " + event.getAttempts()
                        + " attempts: " + message(exception));
                counter("dead").increment();
            } else {
                event.markRetry(now.plus(retryDelay.multipliedBy(event.getAttempts())), message(exception));
                counter("retry").increment();
            }
        }
        outbox.save(event);
    }

    private io.micrometer.core.instrument.Counter counter(String outcome) {
        return meterRegistry.counter("dari.notifications.delivery", "outcome", outcome);
    }

    private String validate(NotificationOutbox event) {
        if (!EVENT_TYPES.contains(event.getEventType())) return "Unsupported notification event type";
        if (event.getPayload() == null || event.getPayload().isBlank()) return "Notification payload is empty";
        return null;
    }

    private String message(RuntimeException exception) {
        return exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
    }
}
