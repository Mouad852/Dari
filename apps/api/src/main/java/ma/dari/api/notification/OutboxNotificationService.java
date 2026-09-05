package ma.dari.api.notification;

import ma.dari.api.listing.Listing;
import ma.dari.api.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutboxNotificationService implements NotificationService {

    private final NotificationOutboxRepository outbox;

    public OutboxNotificationService(NotificationOutboxRepository outbox) {
        this.outbox = outbox;
    }

    @Override
    @Transactional
    public void listingApproved(Object listing) {
        enqueue("LISTING_APPROVED", listing, "Votre annonce a été approuvée");
    }

    @Override
    @Transactional
    public void listingRejected(Object listing, String reason) {
        enqueue("LISTING_REJECTED", listing, reason);
    }

    @Override
    @Transactional
    public void listingSuspended(Object listing) {
        enqueue("LISTING_SUSPENDED", listing, "Votre annonce a été suspendue");
    }

    @Override
    @Transactional
    public void listingReinstated(Object listing) {
        enqueue("LISTING_REINSTATED", listing, "Votre annonce a été rétablie");
    }

    @Override
    @Transactional
    public void listingExpiringSoon(Object listing, int daysRemaining) {
        enqueue("LISTING_EXPIRING_SOON", listing, "Votre annonce expire dans " + daysRemaining + " jours");
    }

    @Override
    @Transactional
    public void listingExpired(Object listing) {
        enqueue("LISTING_EXPIRED", listing, "Votre annonce a expiré et doit être renouvelée");
    }

    @Override
    @Transactional
    public void userWarned(User user, String reason) {
        enqueue("USER_WARNED", user, reason);
    }

    @Override
    @Transactional
    public void userSuspended(User user, String reason) {
        enqueue("USER_SUSPENDED", user, reason);
    }

    @Override
    @Transactional
    public void userBanned(User user, String reason) {
        enqueue("USER_BANNED", user, reason);
    }

    @Override
    @Transactional
    public void reportAcknowledged(User reporter) {
        enqueue("REPORT_ACKNOWLEDGED", reporter, "Votre signalement a bien été reçu");
    }

    private void enqueue(String eventType, Object target, String payload) {
        if (target instanceof Listing listing) {
            outbox.save(new NotificationOutbox(eventType, listing.getOwner().getId(), listing.getId(), payload));
        } else if (target instanceof User user) {
            outbox.save(new NotificationOutbox(eventType, user.getId(), null, payload));
        } else {
            throw new IllegalArgumentException("Unsupported notification target");
        }
    }
}
