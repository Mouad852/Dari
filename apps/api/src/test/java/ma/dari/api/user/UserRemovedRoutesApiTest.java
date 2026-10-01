package ma.dari.api.user;

import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.support.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

/**
 * Routes removed until the feature exists (audit P2-8). A 501 stub advertised
 * phone verification to every client that probed the API; a missing route is
 * an ordinary 404.
 */
class UserRemovedRoutesApiTest extends AbstractIntegrationTest {

    @Autowired
    UserRepository users;

    @Test
    @DisplayName("POST /users/me/phone-verification is not a route any more")
    void phoneVerificationStubIsGone() throws Exception {
        String uid = "uid-removed-routes-" + System.nanoTime();
        users.save(new User(uid, uid + "@example.ma", true, "Removed Routes"));
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(uid + "@example.ma");
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);

        given().header("Authorization", "Bearer test-token")
                .when().post("/users/me/phone-verification")
                .then().statusCode(404)
                .body("code", equalTo("NOT_FOUND"));
    }
}
