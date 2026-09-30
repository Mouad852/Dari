package ma.dari.api.user;

import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.support.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;

/**
 * What a suspended account can still do (audit P2-11): read its own profile,
 * which says it is suspended so the web can explain refused writes, and
 * delete itself. Everything else it writes is refused.
 */
class UserStatusApiTest extends AbstractIntegrationTest {

    @Autowired
    UserRepository users;

    /** Signs up a fresh account, suspends it, and returns its id. */
    private UUID suspendedAccount() throws Exception {
        String uid = "uid-status-" + System.nanoTime();
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(uid + "@example.ma");
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);

        String id = given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\"Salma B.\",\"firstName\":\"Salma\",\"city\":\"Rabat\"}")
                .when().post("/users")
                .then().statusCode(201)
                .body("status", equalTo("ACTIVE"))
                .extract().path("id");

        User user = users.findById(UUID.fromString(id)).orElseThrow();
        user.setStatus(UserStatus.SUSPENDED);
        users.saveAndFlush(user);
        return user.getId();
    }

    @Test
    @DisplayName("the caller's own profile reports ACTIVE, then SUSPENDED once moderation suspends it")
    void meReportsTheAccountStatus() throws Exception {
        suspendedAccount();

        given().header("Authorization", "Bearer test-token")
                .when().get("/users/me")
                .then().statusCode(200)
                .body("status", equalTo("SUSPENDED"));
    }

    @Test
    @DisplayName("a suspended account cannot edit its profile but can still delete itself")
    void aSuspendedAccountCanStillLeave() throws Exception {
        UUID id = suspendedAccount();

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"bio\":\"Toujours là\"}")
                .when().patch("/users/me")
                .then().statusCode(403)
                .body("code", equalTo("ACCOUNT_SUSPENDED"));

        given().header("Authorization", "Bearer test-token")
                .when().delete("/users/me")
                .then().statusCode(204);
        assertThat(users.findById(id).orElseThrow().getDeletedAt()).isNotNull();
    }
}
