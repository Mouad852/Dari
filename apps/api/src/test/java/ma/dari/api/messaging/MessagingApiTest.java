package ma.dari.api.messaging;

import com.google.firebase.auth.FirebaseToken;
import jakarta.validation.Validator;
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

import java.math.BigDecimal;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;

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
    Validator validator;

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
}
