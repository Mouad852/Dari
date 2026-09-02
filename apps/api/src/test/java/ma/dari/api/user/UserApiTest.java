package ma.dari.api.user;

import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.support.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

class UserApiTest extends AbstractIntegrationTest {

    @Autowired
    UserRepository users;

    private void stubToken(String uid, String email, boolean emailVerified) throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(email);
        Mockito.when(token.isEmailVerified()).thenReturn(emailVerified);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);
    }

    @Test
    @DisplayName("valid token, no profile -> 404 PROFILE_NOT_FOUND, and no row is created")
    void missingProfile() throws Exception {
        stubToken("uid-no-profile", "sans-profil@example.ma", true);

        given().header("Authorization", "Bearer test-token")
                .when().get("/users/me")
                .then().statusCode(404)
                .body("code", equalTo("PROFILE_NOT_FOUND"));

        assertThat(users.existsByFirebaseUid("uid-no-profile"))
                .as("the auth filter must never create the profile row")
                .isFalse();
    }

    @Test
    @DisplayName("POST /users then GET /users/me round-trips")
    void createThenFetch() throws Exception {
        stubToken("uid-new", "nouvelle@example.ma", true);

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\"Salma\",\"city\":\"Rabat\"}")
                .when().post("/users")
                .then().statusCode(201)
                .body("displayName", equalTo("Salma"))
                .body("verification", equalTo("EMAIL"));

        given().header("Authorization", "Bearer test-token")
                .when().get("/users/me")
                .then().statusCode(200)
                .body("city", equalTo("Rabat"));
    }

    @Test
    @DisplayName("repeat POST /users is idempotent and returns the existing profile")
    void createIsIdempotent() throws Exception {
        stubToken("uid-idempotent", "idempotent@example.ma", true);

        String firstId = given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\"Salma\",\"city\":\"Rabat\"}")
                .when().post("/users")
                .then().statusCode(201)
                .extract().path("id");

        String secondId = given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\"Different\",\"city\":\"Casablanca\"}")
                .when().post("/users")
                .then().statusCode(200)
                .extract().path("id");

        assertThat(secondId).isEqualTo(firstId);

        given().header("Authorization", "Bearer test-token")
                .when().get("/users/me")
                .then().statusCode(200)
                .body("displayName", equalTo("Salma"))
                .body("city", equalTo("Rabat"));
    }

    @Test
    @DisplayName("banned user -> 403")
    void bannedUserRejected() throws Exception {
        stubToken("uid-banned", "banni@example.ma", true);

        User existing = new User("uid-banned", "banni@example.ma", true, "Banni");
        existing.setStatus(UserStatus.BANNED);
        users.save(existing);

        given().header("Authorization", "Bearer test-token")
                .when().get("/users/me")
                .then().statusCode(403)
                .body("code", equalTo("ACCOUNT_BANNED"));
    }

    @Test
    @DisplayName("public profile exposes no private field")
    void publicProfileLeaksNothing() throws Exception {
        stubToken("uid-public", "publique@example.ma", true);

        String id = given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\"Youssef\"}")
                .when().post("/users")
                .then().statusCode(201)
                .extract().path("id");

        String body = given().when().get("/users/" + id)
                .then().statusCode(200)
                .extract().asString();

        assertThat(body)
                .doesNotContain("email")
                .doesNotContain("phone")
                .doesNotContain("firebaseUid")
                .doesNotContain("status");
    }

    @Test
    @DisplayName("PATCH /users/me ignores email in body")
    void patchMeIgnoresEmail() throws Exception {
        stubToken("uid-patch-email", "original@example.ma", true);

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\"Original\",\"city\":\"Rabat\"}")
                .when().post("/users")
                .then().statusCode(201);

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"email\":\"hacker@example.ma\",\"displayName\":\"Updated\"}")
                .when().patch("/users/me")
                .then().statusCode(200)
                .body("email", equalTo("original@example.ma"))
                .body("displayName", equalTo("Updated"));
    }

    @Test
    @DisplayName("validation failure -> fields populated")
    void validationFailureIncludesFields() throws Exception {
        stubToken("uid-invalid", "invalide@example.ma", true);

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\" \"}")
                .when().post("/users")
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"))
                .body("fields.displayName", notNullValue());
    }

    @Test
    @DisplayName("no Authorization header -> 401 with the error envelope, not 500")
    void unauthenticated() {
        // This passed before the matcher reorder too, but via the @CurrentUser
        // resolver: GET /api/v1/users/* permitted every single-segment path,
        // /users/me included. It is now refused by the security chain, and the
        // body assertion is what proves the envelope survived the move -- the
        // Spring default for a chain rejection is a bodyless 403.
        given().when().get("/users/me")
                .then().statusCode(401)
                .header("WWW-Authenticate", "Bearer")
                .body("code", equalTo("UNAUTHENTICATED"));
    }

    @Test
    @DisplayName("public profile reads stay anonymous")
    void publicProfileRemainsAnonymous() {
        given().when().get("/users/{id}", java.util.UUID.randomUUID())
                .then().statusCode(404);
    }
}
