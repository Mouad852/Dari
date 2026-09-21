package ma.dari.api.support;

import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import ma.dari.api.user.UserRole;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;

import static io.restassured.RestAssured.given;

class ActuatorAuthorizationApiTest extends AbstractIntegrationTest {

    @Autowired
    UserRepository users;

    @Test
    void actuatorMetricsAreAdminOnlyWhileHealthProbesRemainPublic() throws Exception {
        FirebaseToken profileless = token("profileless-actuator", "profileless.actuator@example.ma");
        Mockito.when(firebaseAuth.verifyIdToken("profileless")).thenReturn(profileless);
        given().basePath("").header("Authorization", "Bearer profileless")
                .when().get("/actuator/metrics").then().statusCode(403);

        User user = users.save(new User("user-actuator", "user.actuator@example.ma", true, "User"));
        FirebaseToken userToken = token(user.getFirebaseUid(), user.getEmail());
        Mockito.when(firebaseAuth.verifyIdToken("user")).thenReturn(userToken);
        given().basePath("").header("Authorization", "Bearer user")
                .when().get("/actuator/metrics").then().statusCode(403);

        User admin = new User("admin-actuator", "admin.actuator@example.ma", true, "Admin");
        admin.setRole(UserRole.ADMIN);
        users.save(admin);
        FirebaseToken adminToken = token(admin.getFirebaseUid(), admin.getEmail());
        Mockito.when(firebaseAuth.verifyIdToken("admin")).thenReturn(adminToken);
        given().basePath("").header("Authorization", "Bearer admin")
                .when().get("/actuator/metrics").then().statusCode(200);

        given().basePath("").when().get("/actuator/health/liveness").then().statusCode(200);
    }

    private FirebaseToken token(String uid, String email) {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(email);
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        return token;
    }
}
