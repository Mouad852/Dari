package ma.dari.api.messaging;

import ma.dari.api.listing.AvailabilityState;
import ma.dari.api.listing.Listing;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.messaging.dto.CreateConversationRequest;
import ma.dari.api.messaging.dto.CreateMessageRequest;
import ma.dari.api.notification.NotificationOutbox;
import ma.dari.api.notification.NotificationOutboxRepository;
import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The new-message email (owner decision P0-1): at most one per recipient and
 * conversation every 30 minutes while unread, and never the message text.
 */
class MessageNotificationTest extends AbstractIntegrationTest {

    @Autowired
    ConversationService conversationService;

    @Autowired
    UserRepository users;

    @Autowired
    ListingRepository listings;

    @Autowired
    NotificationOutboxRepository outbox;

    @Autowired
    JdbcTemplate jdbc;

    private User user(String name) {
        String uid = "uid-msg-notif-" + name + "-" + System.nanoTime();
        User user = new User(uid, uid + "@example.ma", true, name + " Test");
        user.setFirstName(name);
        return users.saveAndFlush(user);
    }

    private List<NotificationOutbox> emailsTo(User recipient, UUID conversationId) {
        return outbox.findAll().stream()
                .filter(row -> "NEW_MESSAGE".equals(row.getEventType()))
                .filter(row -> row.getRecipientId().equals(recipient.getId()))
                .filter(row -> conversationId.equals(row.getAggregateId()))
                .toList();
    }

    private UUID openConversation(User seeker, User owner) {
        Listing listing = listings.saveAndFlush(new Listing(owner, "Chambre près de la gare", "Rabat", "Agdal",
                33.9716, -6.8498, new BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));
        return conversationService.create(seeker,
                        new CreateConversationRequest(listing.getId(), null, "Bonjour, 06 12 34 56 78, appelez-moi"))
                .response().id();
    }

    private void send(User from, UUID conversationId, String body) {
        conversationService.sendMessage(from, conversationId, new CreateMessageRequest(body));
    }

    @Test
    @DisplayName("the first message emails the recipient: sender, listing and link, never the text")
    void firstMessageEmailsTheRecipient() {
        User amal = user("Amal");
        User badr = user("Badr");

        UUID conversationId = openConversation(amal, badr);

        assertThat(emailsTo(badr, conversationId)).singleElement().satisfies(email -> {
            assertThat(email.getSubject()).isEqualTo("Nouveau message de Amal à propos de « Chambre près de la gare »");
            assertThat(email.getPayload())
                    .startsWith("Bonjour Badr,")
                    .contains("/messages/" + conversationId)
                    .doesNotContain("06 12 34 56 78")
                    .doesNotContain("appelez-moi");
        });
        assertThat(emailsTo(amal, conversationId)).as("the sender is not emailed").isEmpty();
    }

    @Test
    @DisplayName("more messages while unread inside 30 minutes send no more email; reading resets it")
    void unreadMessagesInsideTheWindowAreNotEmailedAgain() {
        User amal = user("Amal");
        User badr = user("Badr");
        UUID conversationId = openConversation(amal, badr);

        send(amal, conversationId, "Toujours disponible ?");
        send(amal, conversationId, "Je peux visiter samedi.");
        assertThat(emailsTo(badr, conversationId)).hasSize(1);

        conversationService.markRead(badr, conversationId);
        send(amal, conversationId, "Et dimanche ?");
        assertThat(emailsTo(badr, conversationId)).as("read, so the next message is new again").hasSize(2);

        send(badr, conversationId, "Dimanche me va.");
        assertThat(emailsTo(amal, conversationId)).as("a reply emails the other side").hasSize(1);
    }

    @Test
    @DisplayName("still unread after 30 minutes, the next message emails again")
    void stillUnreadAfterTheWindowEmailsAgain() {
        User amal = user("Amal");
        User badr = user("Badr");
        UUID conversationId = openConversation(amal, badr);

        // The first email, as if sent 31 minutes ago; Badr has not read anything.
        jdbc.update("UPDATE notification_outbox SET created_at = created_at - interval '31 minutes' "
                + "WHERE event_type = 'NEW_MESSAGE' AND recipient_id = ? AND aggregate_id = ?",
                badr.getId(), conversationId);

        send(amal, conversationId, "Vous avez vu mon message ?");
        assertThat(emailsTo(badr, conversationId)).hasSize(2);
    }
}
