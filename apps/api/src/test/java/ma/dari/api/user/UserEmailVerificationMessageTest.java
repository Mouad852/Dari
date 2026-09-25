package ma.dari.api.user;

import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

class UserEmailVerificationMessageTest extends AbstractIntegrationTest {

    @Test
    void unverifiedEmailReturnsCorrectFrenchMessage() throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn("uid-message-unverified");
        Mockito.when(token.getEmail()).thenReturn("non-verifie@example.ma");
        Mockito.when(token.isEmailVerified()).thenReturn(false);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\"Salma\"}")
                .when().post("/users")
                .then().statusCode(403)
                .body("message", equalTo("Vérifiez votre adresse e-mail avant de créer votre profil"));
    }
}
