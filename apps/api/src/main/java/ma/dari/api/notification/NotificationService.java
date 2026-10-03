package ma.dari.api.notification;

import ma.dari.api.user.User;

import java.util.UUID;

/**
 * Outbound notifications.
 *
 * <p>The interface exists from the start so moderation code (phase 06) can call
 * it before delivery is built (phase 10). The failure mode this guards against
 * is not a broken transport — it is a moderation decision that lands silently on
 * an owner because someone forgot the call.
 *
 * <p>Implementations enqueue; they never send inline. An SMTP timeout inside an
 * admin action must not roll back the moderation decision.
 *
 * <p>Copy follows the interface's rules: French, <em>vous</em>, sentence case,
 * plain and non-blaming, no emoji, no exclamation marks.
 */
public interface NotificationService {

    void listingApproved(Object listing);

    void listingRejected(Object listing, String reason);

    void listingSuspended(Object listing);

    void listingReinstated(Object listing);

    void listingExpiringSoon(Object listing, int daysRemaining);

    void listingExpired(Object listing);

    void userWarned(User user, String reason);

    void userSuspended(User user, String reason);

    void userBanned(User user, String reason);

    /**
     * Confirms a report was received. Nothing more.
     *
     * <p>Not the outcome, not the target's state, not whether anyone acted.
     * Email is the easiest place to leak that by trying to be helpful.
     */
    void reportAcknowledged(User reporter);

    /**
     * Tells the recipient a message is waiting (owner decision P0-1). Never the
     * message text: the email names the sender and the listing and links to the
     * thread, where the recipient reads it signed in.
     *
     * <p>At most one email per recipient and conversation every 30 minutes
     * while they have not read it. {@code firstUnread} means they had read
     * everything else in the conversation, so this message starts a new unread
     * run and is emailed whatever the window.
     *
     * @param listingTitle the conversation's listing, or null for a direct one
     */
    void newMessage(User recipient, User sender, UUID conversationId, String listingTitle, boolean firstUnread);
}
