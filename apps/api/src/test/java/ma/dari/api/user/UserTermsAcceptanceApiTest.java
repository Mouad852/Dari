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

/** The terms version accepted at sign-up is kept with the account (owner decision P1-15). */
class UserTermsAcceptanceApiTest extends AbstractIntegrationTest {

    @Autowired
    UserRepository users;

    private void signedInAs(String uid) throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(uid + "@example.ma");
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);
    }

    @Test
    @DisplayName("the accepted terms version and its time are stored on the new account")
    void acceptedVersionIsStored() throws Exception {
        String uid = "uid-terms-" + System.nanoTime();
        signedInAs(uid);

        String id = given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\"Salma B.\",\"acceptedTermsVersion\":\" 2026-10 \"}")
                .when().post("/users")
                .then().statusCode(201)
                .extract().path("id");

        User stored = users.findById(UUID.fromString(id)).orElseThrow();
        assertThat(stored.getTermsVersion()).isEqualTo("2026-10");
        assertThat(stored.getTermsAcceptedAt()).isNotNull();
    }

    @Test
    @DisplayName("an over-long version is refused")
    void overLongVersionIsRefused() throws Exception {
        signedInAs("uid-terms-long-" + System.nanoTime());

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\"Salma B.\",\"acceptedTermsVersion\":\"" + "v".repeat(65) + "\"}")
                .when().post("/users")
                .then().statusCode(400);
    }
}
