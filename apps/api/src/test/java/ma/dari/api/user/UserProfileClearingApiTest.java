package ma.dari.api.user;

import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.support.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

/**
 * PATCH /users/me semantics for optional profile fields: absent leaves a field
 * unchanged, blank clears it. Clearing matters because bio and city are shown
 * on the public profile.
 */
class UserProfileClearingApiTest extends AbstractIntegrationTest {

    private String signUp(String displayName) throws Exception {
        String uid = "uid-clear-" + System.nanoTime();
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(uid + "@example.ma");
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);

        return given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\"" + displayName + "\",\"firstName\":\"Salma\",\"city\":\"Rabat\"}")
                .when().post("/users")
                .then().statusCode(201)
                .extract().path("id");
    }

    @Test
    @DisplayName("blank optional fields are cleared on the account and the public profile")
    void blankFieldsClearPublicData() throws Exception {
        String id = signUp("Salma B.");
        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"bio\":\"Étudiante en master, calme.\"}")
                .when().patch("/users/me")
                .then().statusCode(200)
                .body("bio", equalTo("Étudiante en master, calme."));

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"bio\":\"\",\"city\":\"   \",\"firstName\":\"\"}")
                .when().patch("/users/me")
                .then().statusCode(200)
                .body("bio", nullValue())
                .body("city", nullValue())
                .body("firstName", nullValue())
                .body("displayName", equalTo("Salma B."));

        given().header("Authorization", "Bearer test-token")
                .when().get("/users/me")
                .then().statusCode(200)
                .body("bio", nullValue())
                .body("city", nullValue());

        given().when().get("/users/{id}", id)
                .then().statusCode(200)
                .body("bio", nullValue())
                .body("city", nullValue());
    }

    @Test
    @DisplayName("absent fields are unchanged and values are trimmed")
    void absentFieldsAreUnchanged() throws Exception {
        signUp("Karim");

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"bio\":\"  Ingénieur à Casablanca  \"}")
                .when().patch("/users/me")
                .then().statusCode(200)
                .body("bio", equalTo("Ingénieur à Casablanca"))
                .body("city", equalTo("Rabat"))
                .body("firstName", equalTo("Salma"));
    }

    @Test
    @DisplayName("the display name cannot be cleared")
    void displayNameCannotBeBlank() throws Exception {
        signUp("Nadia");

        given().header("Authorization", "Bearer test-token")
                .contentType("application/json")
                .body("{\"displayName\":\"   \"}")
                .when().patch("/users/me")
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"));

        given().header("Authorization", "Bearer test-token")
                .when().get("/users/me")
                .then().statusCode(200)
                .body("displayName", equalTo("Nadia"));
    }
}
