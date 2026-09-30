package ma.dari.api.notification;

import ma.dari.api.listing.Listing;
import ma.dari.api.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OutboxNotificationService implements NotificationService {

    private final NotificationOutboxRepository outbox;
    private final NotificationTemplates templates;

    public OutboxNotificationService(NotificationOutboxRepository outbox, NotificationTemplates templates) {
        this.outbox = outbox;
        this.templates = templates;
    }

    @Override
    @Transactional
    public void listingApproved(Object listing) {
        Listing target = listing(listing);
        enqueue("LISTING_APPROVED", target, templates.listingApproved(target));
    }

    @Override
    @Transactional
    public void listingRejected(Object listing, String reason) {
        Listing target = listing(listing);
        enqueue("LISTING_REJECTED", target, templates.listingRejected(target, reason));
    }

    @Override
    @Transactional
    public void listingSuspended(Object listing) {
        Listing target = listing(listing);
        enqueue("LISTING_SUSPENDED", target, templates.listingSuspended(target));
    }

    @Override
    @Transactional
    public void listingReinstated(Object listing) {
        Listing target = listing(listing);
        enqueue("LISTING_REINSTATED", target, templates.listingReinstated(target));
    }

    @Override
    @Transactional
    public void listingExpiringSoon(Object listing, int daysRemaining) {
        enqueue("LISTING_EXPIRING_SOON", listing, "Votre annonce expire dans " + daysRemaining
                + (daysRemaining == 1 ? " jour" : " jours"));
    }

    @Override
    @Transactional
    public void listingExpired(Object listing) {
        enqueue("LISTING_EXPIRED", listing, "Votre annonce a expiré et doit être renouvelée");
    }

    @Override
    @Transactional
    public void userWarned(User user, String reason) {
        enqueue("USER_WARNED", user, templates.userWarned(user, reason));
    }

    @Override
    @Transactional
    public void userSuspended(User user, String reason) {
        enqueue("USER_SUSPENDED", user, templates.userSuspended(user, reason));
    }

    @Override
    @Transactional
    public void userBanned(User user, String reason) {
        enqueue("USER_BANNED", user, templates.userBanned(user, reason));
    }

    @Override
    @Transactional
    public void reportAcknowledged(User reporter) {
        enqueue("REPORT_ACKNOWLEDGED", reporter, "Votre signalement a bien été reçu");
    }

    private void enqueue(String eventType, Listing listing, NotificationTemplates.Email email) {
        outbox.save(new NotificationOutbox(eventType, listing.getOwner().getId(), listing.getId(),
                email.subject(), email.body()));
    }

    private void enqueue(String eventType, User user, NotificationTemplates.Email email) {
        outbox.save(new NotificationOutbox(eventType, user.getId(), null, email.subject(), email.body()));
    }

    private static Listing listing(Object target) {
        if (target instanceof Listing listing) return listing;
        throw new IllegalArgumentException("Unsupported notification target");
    }

    /** Events still sent as a short phrase under the generic subject (expiry, reports: task 4.3b). */
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
