package ma.dari.api.messaging;

import com.google.firebase.auth.FirebaseToken;
import jakarta.validation.Validator;
import ma.dari.api.common.pagination.Cursor;
import ma.dari.api.common.pagination.TypedCursors;
import ma.dari.api.listing.AvailabilityState;
import ma.dari.api.listing.Listing;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import ma.dari.api.messaging.dto.CreateConversationRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

class MessagingApiTest extends AbstractIntegrationTest {

    @Autowired
    UserRepository users;

    @Autowired
    ListingRepository listings;

    @Autowired
    ConversationRepository conversations;

    @Autowired
    MessageRepository messages;

    @Autowired
    ConversationService conversationService;

    @Autowired
    Validator validator;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    @DisplayName("conversation input enforces a target and the message size limit")
    void conversationInputIsBounded() {
        String oversizedBody = "x".repeat(4001);

        assertThat(validator.validate(new CreateConversationRequest(null, null, null)))
                .anyMatch(violation -> violation.getMessage().contains("inclure"));
        assertThat(validator.validate(new CreateConversationRequest(null, null, oversizedBody)))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("body"));
    }

    private void stubToken(String uid, String email, boolean emailVerified) throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(email);
        Mockito.when(token.isEmailVerified()).thenReturn(emailVerified);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);
    }

    @Test
    @DisplayName("conversation can be created and a message can be sent")
    void createConversationAndSendMessage() throws Exception {
        User owner = users.save(new User("uid-owner-messaging", "owner.messaging@example.ma", true, "Owner"));
        User seeker = users.save(new User("uid-seeker-messaging", "seeker.messaging@example.ma", true, "Seeker"));

        Listing listing = listings.saveAndFlush(new Listing(
                owner,
                "Studio Rabat",
                "Rabat",
                "Agdal",
                33.9716,
                -6.8498,
                new BigDecimal("2600.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        ));

        stubToken("uid-seeker-messaging", "seeker.messaging@example.ma", true);

        String conversationId = given().header("Authorization", "Bearer test-token")
                .header("Authorization", "Bearer " + "uid-c")
                .contentType("application/json")
                .body("{\"listingId\":\"" + listing.getId() + "\",\"body\":\"Bonjour, est-il encore disponible ?\"}")
                .when().post("/conversations")
                .then().statusCode(201)
                .extract().path("id");

        given().header("Authorization", "Bearer test-token")
                .when().get("/conversations")
                .then().statusCode(200)
                .body("items.size()", equalTo(1));

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"body\":\"Oui, je peux vous montrer le logement.\"}")
                .when().post("/conversations/" + conversationId + "/messages")
                .then().statusCode(201)
                .body("body", equalTo("Oui, je peux vous montrer le logement."));

        given().header("Authorization", "Bearer test-token")
                .when().get("/conversations/" + conversationId + "/messages")
                .then().statusCode(200)
                .body("items.size()", equalTo(2));

        given().header("Authorization", "Bearer test-token")
                .when().get("/conversations/" + conversationId)
                .then().statusCode(200)
                .body("id", equalTo(conversationId))
                .body("listingId", equalTo(listing.getId().toString()))
                .body("otherUserDisplayName", equalTo("Owner"));
    }

    @Test
    @DisplayName("listing contact must target the listing owner")
    void listingContactRejectsMismatchedUser() throws Exception {
        User owner = users.saveAndFlush(new User("uid-listing-owner-mismatch", "owner-mismatch@example.ma", true, "Owner"));
        User seeker = users.saveAndFlush(new User("uid-listing-seeker-mismatch", "seeker-mismatch@example.ma", true, "Seeker"));
        User unrelated = users.saveAndFlush(new User("uid-listing-unrelated", "unrelated@example.ma", true, "Unrelated"));
        Listing listing = listings.saveAndFlush(new Listing(
                owner, "Studio ciblé", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));

        stubToken("uid-listing-seeker-mismatch", "seeker-mismatch@example.ma", true);

        given().header("Authorization", "Bearer mismatch-token")
                .contentType("application/json")
                .body("{\"listingId\":\"" + listing.getId() + "\",\"otherUserId\":\""
                        + unrelated.getId() + "\"}")
                .when().post("/conversations")
                .then().statusCode(403)
                .body("code", equalTo("FORBIDDEN"));

        assertThat(conversations.findByListingAndParticipantPair(
                listing.getId(), seeker.getId(), owner.getId())).isEmpty();
    }

    @Test
    @DisplayName("self-contact remains forbidden")
    void selfContactIsRejected() throws Exception {
        User self = users.saveAndFlush(new User("uid-self-contact", "self-contact@example.ma", true, "Self"));
        stubToken("uid-self-contact", "self-contact@example.ma", true);

        given().header("Authorization", "Bearer self-contact-token")
                .contentType("application/json")
                .body("{\"otherUserId\":\"" + self.getId() + "\"}")
                .when().post("/conversations")
                .then().statusCode(403)
                .body("code", equalTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("parallel direct conversation creation leaves one row and reports one creator")
    void parallelDirectConversationCreationIsUnique() throws Exception {
        User first = users.saveAndFlush(new User("uid-direct-race-a", "direct-race-a@example.ma", true, "First"));
        User second = users.saveAndFlush(new User("uid-direct-race-b", "direct-race-b@example.ma", true, "Second"));
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            Future<ConversationService.ConversationCreateResult> one = executor.submit(() -> {
                ready.countDown();
                start.await(10, TimeUnit.SECONDS);
                return conversationService.create(first, new CreateConversationRequest(null, second.getId(), null));
            });
            Future<ConversationService.ConversationCreateResult> two = executor.submit(() -> {
                ready.countDown();
                start.await(10, TimeUnit.SECONDS);
                return conversationService.create(second, new CreateConversationRequest(null, first.getId(), null));
            });

            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            ConversationService.ConversationCreateResult resultOne = one.get(20, TimeUnit.SECONDS);
            ConversationService.ConversationCreateResult resultTwo = two.get(20, TimeUnit.SECONDS);

            assertThat(List.of(resultOne.created(), resultTwo.created())).containsExactlyInAnyOrder(true, false);
            assertThat(conversations.findAll().stream()
                    .filter(c -> c.getListing() == null && c.isParticipant(first) && c.isParticipant(second)))
                    .hasSize(1);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    @DisplayName("a non-participant cannot fetch a conversation's header")
    void getConversationForbiddenForNonParticipant() throws Exception {
        User first = users.save(new User("uid-a-get", "a-get@example.ma", true, "A"));
        User second = users.save(new User("uid-b-get", "b-get@example.ma", true, "B"));
        User outsider = users.save(new User("uid-c-get", "c-get@example.ma", true, "C"));
        Conversation conversation = conversations.save(new Conversation(first, second));

        stubToken("uid-c-get", "c-get@example.ma", true);

        given().header("Authorization", "Bearer outsider-token")
                .when().get("/conversations/" + conversation.getId())
                .then().statusCode(403)
                .body("code", equalTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("non-participant cannot read or send a message")
    void nonParticipantForbidden() throws Exception {
        User first = users.save(new User("uid-a", "a@example.ma", true, "A"));
        User second = users.save(new User("uid-b", "b@example.ma", true, "B"));
        User outsider = users.save(new User("uid-c", "c@example.ma", true, "C"));

        Conversation conversation = conversations.save(new Conversation(first, second));
        messages.save(new Message(conversation, first, "Hello"));

        stubToken("uid-c", "c@example.ma", true);

        given().header("Authorization", "Bearer outsider-token")
                .when().get("/conversations/" + conversation.getId() + "/messages")
                .then().statusCode(403)
                .body("code", equalTo("FORBIDDEN"));

        given().header("Authorization", "Bearer uid-c")
                .contentType("application/json")
                .body("{\"body\":\"Intrusion\"}")
                .header("Authorization", "Bearer " + "uid-c")
                .when().post("/conversations/" + conversation.getId() + "/messages")
                .then().statusCode(403)
                .body("code", equalTo("FORBIDDEN"));
    }

    /**
     * {@code count} messages, three to a timestamp so the id tie-break is
     * exercised, returned in the order the API must serve them. The order comes
     * from Postgres itself: its uuid comparison is not {@link UUID#compareTo}.
     */
    private List<String> seedThread(Conversation conversation, User first, User second, int count) {
        Instant base = Instant.parse("2026-09-01T08:00:00Z");
        for (int i = 0; i < count; i++) {
            Message message = messages.save(new Message(conversation, i % 2 == 0 ? first : second, "Message " + i));
            jdbc.update("update messages set sent_at = ? where id = ?", Timestamp.from(base.plusSeconds(i / 3)), message.getId());
        }
        return jdbc.queryForList("select id::text from messages where conversation_id = ? order by sent_at, id",
                String.class, conversation.getId());
    }

    @Test
    @DisplayName("a thread opens at its newest page and pages back to the first message with no gap or duplicate")
    void threadOpensAtNewestAndPagesBackwards() throws Exception {
        User owner = users.save(new User("uid-owner-paging", "owner.paging@example.ma", true, "Owner"));
        User seeker = users.save(new User("uid-seeker-paging", "seeker.paging@example.ma", true, "Seeker"));
        Conversation conversation = conversations.save(new Conversation(owner, seeker));
        List<String> expected = seedThread(conversation, owner, seeker, 45);
        stubToken("uid-seeker-paging", "seeker.paging@example.ma", true);

        var newest = given().header("Authorization", "Bearer test-token")
                .when().get("/conversations/" + conversation.getId() + "/messages")
                .then().statusCode(200)
                .extract().jsonPath();
        assertThat(newest.getList("items.id", String.class)).containsExactlyElementsOf(expected.subList(25, 45));
        assertThat(newest.getBoolean("hasMore")).isTrue();

        List<String> seen = new ArrayList<>(newest.getList("items.id", String.class));
        String cursor = newest.getString("nextCursor");
        int pages = 1;
        while (cursor != null) {
            var older = given().header("Authorization", "Bearer test-token")
                    .queryParam("cursor", cursor)
                    .when().get("/conversations/" + conversation.getId() + "/messages")
                    .then().statusCode(200)
                    .extract().jsonPath();
            seen.addAll(0, older.getList("items.id", String.class));
            cursor = older.getString("nextCursor");
            pages++;
        }

        assertThat(pages).isEqualTo(3);
        assertThat(seen).containsExactlyElementsOf(expected);
    }

    @Test
    @DisplayName("after= returns only newer messages, one page at a time, and picks up a new reply")
    void afterReturnsOnlyNewerMessages() throws Exception {
        User owner = users.save(new User("uid-owner-after", "owner.after@example.ma", true, "Owner"));
        User seeker = users.save(new User("uid-seeker-after", "seeker.after@example.ma", true, "Seeker"));
        Conversation conversation = conversations.save(new Conversation(owner, seeker));
        List<String> expected = seedThread(conversation, owner, seeker, 45);
        stubToken("uid-seeker-after", "seeker.after@example.ma", true);
        String path = "/conversations/" + conversation.getId() + "/messages";

        // Index 10 shares its timestamp with 9 and 11: the id decides both sides.
        var first = given().header("Authorization", "Bearer test-token")
                .queryParam("after", expected.get(10))
                .when().get(path)
                .then().statusCode(200)
                .body("nextCursor", nullValue())
                .extract().jsonPath();
        assertThat(first.getList("items.id", String.class)).containsExactlyElementsOf(expected.subList(11, 31));
        assertThat(first.getBoolean("hasMore")).isTrue();

        var rest = given().header("Authorization", "Bearer test-token")
                .queryParam("after", expected.get(30))
                .when().get(path)
                .then().statusCode(200)
                .extract().jsonPath();
        assertThat(rest.getList("items.id", String.class)).containsExactlyElementsOf(expected.subList(31, 45));
        assertThat(rest.getBoolean("hasMore")).isFalse();

        given().header("Authorization", "Bearer test-token")
                .queryParam("after", expected.get(44))
                .when().get(path)
                .then().statusCode(200)
                .body("items.size()", equalTo(0))
                .body("hasMore", equalTo(false));

        Message reply = messages.save(new Message(conversation, owner, "Oui, toujours disponible."));
        given().header("Authorization", "Bearer test-token")
                .queryParam("after", expected.get(44))
                .when().get(path)
                .then().statusCode(200)
                .body("items.id", contains(reply.getId().toString()))
                .body("hasMore", equalTo(false));
    }

    @Test
    @DisplayName("after= is refused with cursor, and an unknown or foreign id gets the same answer")
    void afterIsValidatedWithoutAnExistenceOracle() throws Exception {
        User owner = users.save(new User("uid-owner-after-bad", "owner.after-bad@example.ma", true, "Owner"));
        User seeker = users.save(new User("uid-seeker-after-bad", "seeker.after-bad@example.ma", true, "Seeker"));
        User third = users.save(new User("uid-third-after-bad", "third.after-bad@example.ma", true, "Third"));
        Conversation conversation = conversations.save(new Conversation(owner, seeker));
        Message own = messages.save(new Message(conversation, owner, "Bonjour"));
        Conversation elsewhere = conversations.save(new Conversation(owner, third));
        Message foreign = messages.save(new Message(elsewhere, third, "Ailleurs"));
        stubToken("uid-seeker-after-bad", "seeker.after-bad@example.ma", true);
        String path = "/conversations/" + conversation.getId() + "/messages";

        var olderPayload = Cursor.newPayload();
        olderPayload.put("mode", TypedCursors.OLDER_MESSAGES_MODE);
        olderPayload.put("conversationId", conversation.getId().toString());
        olderPayload.put("lastSentAt", Instant.now().toString());
        olderPayload.put("lastId", own.getId().toString());
        given().header("Authorization", "Bearer test-token")
                .queryParam("cursor", Cursor.encode(olderPayload))
                .queryParam("after", own.getId().toString())
                .when().get(path)
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"));

        String foreignAnswer = given().header("Authorization", "Bearer test-token")
                .queryParam("after", foreign.getId().toString())
                .when().get(path)
                .then().statusCode(400)
                .body("code", equalTo("INVALID_CURSOR"))
                .extract().asString();
        String unknownAnswer = given().header("Authorization", "Bearer test-token")
                .queryParam("after", UUID.randomUUID().toString())
                .when().get(path)
                .then().statusCode(400)
                .extract().asString();
        assertThat(unknownAnswer).isEqualTo(foreignAnswer);

        given().header("Authorization", "Bearer test-token")
                .queryParam("after", "not-a-uuid")
                .when().get(path)
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"));

        // A cursor minted by the old forward-paging contract is refused, not read backwards.
        var forwardPayload = Cursor.newPayload();
        forwardPayload.put("mode", "messages");
        forwardPayload.put("conversationId", conversation.getId().toString());
        forwardPayload.put("lastSentAt", own.getSentAt().toString());
        forwardPayload.put("lastId", own.getId().toString());
        given().header("Authorization", "Bearer test-token")
                .queryParam("cursor", Cursor.encode(forwardPayload))
                .when().get(path)
                .then().statusCode(400)
                .body("code", equalTo("INVALID_CURSOR"));
    }

    @Test
    @DisplayName("a stranger is refused whether they page older or newer")
    void strangerIsRefusedInEveryPagingMode() throws Exception {
        User first = users.save(new User("uid-a-modes", "a-modes@example.ma", true, "A"));
        User second = users.save(new User("uid-b-modes", "b-modes@example.ma", true, "B"));
        users.save(new User("uid-c-modes", "c-modes@example.ma", true, "C"));
        Conversation conversation = conversations.save(new Conversation(first, second));
        Message message = messages.save(new Message(conversation, first, "Hello"));
        stubToken("uid-c-modes", "c-modes@example.ma", true);
        String path = "/conversations/" + conversation.getId() + "/messages";

        given().header("Authorization", "Bearer outsider-token")
                .queryParam("after", message.getId().toString())
                .when().get(path)
                .then().statusCode(403)
                .body("code", equalTo("FORBIDDEN"));
        given().header("Authorization", "Bearer outsider-token")
                .queryParam("after", UUID.randomUUID().toString())
                .when().get(path)
                .then().statusCode(403)
                .body("code", equalTo("FORBIDDEN"));
        given().header("Authorization", "Bearer outsider-token")
                .queryParam("cursor", "anything")
                .when().get(path)
                .then().statusCode(403)
                .body("code", equalTo("FORBIDDEN"));
    }

    @Test
    @DisplayName("mark read marks unread messages as read")
    void markReadMarksUnreadMessages() throws Exception {
        User owner = users.save(new User("uid-owner-read", "owner.read@example.ma", true, "Owner"));
        User seeker = users.save(new User("uid-seeker-read", "seeker.read@example.ma", true, "Seeker"));
        Conversation conversation = conversations.save(new Conversation(owner, seeker));
        Message message = messages.save(new Message(conversation, owner, "Bonjour"));

        stubToken("uid-seeker-read", "seeker.read@example.ma", true);

        given().header("Authorization", "Bearer seeker-read-token")
                .when().patch("/conversations/" + conversation.getId() + "/read")
                .then().statusCode(200);

        assertThat(messages.findById(message.getId())).isPresent();
        assertThat(messages.findById(message.getId()).get().getReadAt()).isNotNull();
    }

    @Test
    @DisplayName("conversation summary exposes the last message's id and read state, populated once marked read")
    void conversationSummaryExposesLastMessageReadState() throws Exception {
        User owner = users.save(new User("uid-owner-receipt", "owner.receipt@example.ma", true, "Owner"));
        User seeker = users.save(new User("uid-seeker-receipt", "seeker.receipt@example.ma", true, "Seeker"));
        Conversation conversation = conversations.save(new Conversation(owner, seeker));
        Message message = messages.save(new Message(conversation, owner, "Toujours disponible ?"));

        stubToken("uid-owner-receipt", "owner.receipt@example.ma", true);

        given().header("Authorization", "Bearer owner-receipt-token")
                .when().get("/conversations/" + conversation.getId())
                .then().statusCode(200)
                .body("lastMessageId", equalTo(message.getId().toString()))
                .body("lastMessageReadAt", nullValue());

        stubToken("uid-seeker-receipt", "seeker.receipt@example.ma", true);

        given().header("Authorization", "Bearer seeker-receipt-token")
                .when().patch("/conversations/" + conversation.getId() + "/read")
                .then().statusCode(200);

        stubToken("uid-owner-receipt", "owner.receipt@example.ma", true);

        given().header("Authorization", "Bearer owner-receipt-token")
                .when().get("/conversations/" + conversation.getId())
                .then().statusCode(200)
                .body("lastMessageId", equalTo(message.getId().toString()))
                .body("lastMessageReadAt", notNullValue());
    }

    @Test
    @DisplayName("conversation list reports unread count for the current user, cleared by marking read")
    void conversationListReportsUnreadCount() throws Exception {
        User owner = users.save(new User("uid-owner-unread", "owner.unread@example.ma", true, "Owner"));
        User seeker = users.save(new User("uid-seeker-unread", "seeker.unread@example.ma", true, "Seeker"));
        Conversation conversation = conversations.save(new Conversation(owner, seeker));
        // Both from the owner: unreadCount is from the current user's (seeker's)
        // perspective, so it must count only messages sent by the other party.
        messages.save(new Message(conversation, owner, "Bonjour"));
        messages.save(new Message(conversation, owner, "Toujours disponible ?"));

        stubToken("uid-seeker-unread", "seeker.unread@example.ma", true);

        given().header("Authorization", "Bearer seeker-unread-token")
                .when().get("/conversations")
                .then().statusCode(200)
                .body("items[0].unreadCount", equalTo(2));

        given().header("Authorization", "Bearer seeker-unread-token")
                .when().patch("/conversations/" + conversation.getId() + "/read")
                .then().statusCode(200);

        given().header("Authorization", "Bearer seeker-unread-token")
                .when().get("/conversations")
                .then().statusCode(200)
                .body("items[0].unreadCount", equalTo(0));
    }

    @Test
    @DisplayName("unread-count sums across every conversation and drops once each is marked read")
    void unreadCountSumsAcrossConversations() throws Exception {
        User seeker = users.save(new User("uid-seeker-total", "seeker.total@example.ma", true, "Seeker"));
        User ownerOne = users.save(new User("uid-owner-total-1", "owner.total1@example.ma", true, "Owner One"));
        User ownerTwo = users.save(new User("uid-owner-total-2", "owner.total2@example.ma", true, "Owner Two"));
        Conversation withOwnerOne = conversations.save(new Conversation(ownerOne, seeker));
        Conversation withOwnerTwo = conversations.save(new Conversation(ownerTwo, seeker));
        messages.save(new Message(withOwnerOne, ownerOne, "Bonjour"));
        messages.save(new Message(withOwnerOne, ownerOne, "Toujours disponible ?"));
        messages.save(new Message(withOwnerTwo, ownerTwo, "Bonjour aussi"));
        // From the seeker themself, in their own thread -- must not count toward
        // their own unread total.
        messages.save(new Message(withOwnerOne, seeker, "Oui, ça m'intéresse"));

        stubToken("uid-seeker-total", "seeker.total@example.ma", true);

        given().header("Authorization", "Bearer seeker-total-token")
                .when().get("/conversations/unread-count")
                .then().statusCode(200)
                .body("unreadCount", equalTo(3));

        given().header("Authorization", "Bearer seeker-total-token")
                .when().patch("/conversations/" + withOwnerOne.getId() + "/read")
                .then().statusCode(200);

        given().header("Authorization", "Bearer seeker-total-token")
                .when().get("/conversations/unread-count")
                .then().statusCode(200)
                .body("unreadCount", equalTo(1));
    }
}
