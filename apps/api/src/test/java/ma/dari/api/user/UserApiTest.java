package ma.dari.api.user;

import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.listing.AvailabilityState;
import ma.dari.api.listing.Listing;
import ma.dari.api.listing.ListingRepository;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.media.ImageStore;
import ma.dari.api.support.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

class UserApiTest extends AbstractIntegrationTest {

    @Autowired
    UserRepository users;

    @Autowired
    ListingRepository listings;

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

        User existing = users.findById(java.util.UUID.fromString(id)).orElseThrow();
        existing.setPhone("+212600000000");
        existing.setStatus(UserStatus.SUSPENDED);
        users.saveAndFlush(existing);

        String body = given().when().get("/users/" + id)
                .then().statusCode(200)
                .extract().asString();

        assertThat(body)
                .doesNotContain("email")
                .doesNotContain("phone")
                .doesNotContain("firebaseUid")
                .doesNotContain("status")
                .doesNotContain("publique@example.ma")
                .doesNotContain("+212600000000")
                .doesNotContain("uid-public");
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

    @Test
    @DisplayName("avatar upload stores the image and points the profile at it")
    void avatarUploadWorks() throws Exception {
        String uid = "uid-avatar-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        users.saveAndFlush(new User(uid, email, true, "Avatar Owner"));

        String url = given().header("Authorization", "Bearer avatar-token")
                .multiPart("file", "me.jpg", generateJpeg(320, 240), "image/jpeg")
                .when().post("/users/me/avatar")
                .then().statusCode(200)
                .extract().path("avatarUrl");

        assertThat(url).startsWith("/uploads/" + ImageStore.AVATARS + "/");

        // Same pipeline as listing photos, so the same validation applies: a
        // profile photo carries GPS just as readily as a listing photo does.
        given().header("Authorization", "Bearer avatar-token")
                .multiPart("file", "notes.txt", "not an image".getBytes(), "text/plain")
                .when().post("/users/me/avatar")
                .then().statusCode(400)
                .body("code", equalTo("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("account deletion soft-deletes the row and the listings, and drops the Firebase identity")
    void accountDeletionCascades() throws Exception {
        String uid = "uid-delete-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        User user = users.saveAndFlush(new User(uid, email, true, "To Delete"));

        Listing owned = listings.saveAndFlush(new Listing(
                user, "Studio à supprimer", "Rabat", "Agdal", 33.9716, -6.8498,
                new BigDecimal("2500.00"), ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE));

        given().header("Authorization", "Bearer delete-token")
                .when().delete("/users/me")
                .then().statusCode(204);

        assertThat(users.findById(user.getId()).orElseThrow().getDeletedAt()).isNotNull();
        assertThat(listings.findById(owned.getId()).orElseThrow().getDeletedAt()).isNotNull();
        Mockito.verify(firebaseAuth).deleteUser(uid);

        // Deleting the Firebase identity does not invalidate an already-issued
        // ID token, so the filter has to refuse the deleted row directly.
        given().header("Authorization", "Bearer delete-token")
                .when().get("/users/me")
                .then().statusCode(401);
    }

    @Test
    @DisplayName("account deletion scrubs personal data from the row and removes the stored avatar")
    void accountDeletionScrubsPii() throws Exception {
        String uid = "uid-scrub-" + System.nanoTime();
        String email = uid + "@example.ma";
        stubToken(uid, email, true);
        User user = new User(uid, email, true, "Personne Réelle");
        user.setFirstName("Réelle");
        user.setPhone("+212600000000");
        user.setPhoneVerified(true);
        user.setCity("Marrakech");
        user.setBio("Ceci est ma bio.");
        users.saveAndFlush(user);

        String avatarUrl = given().header("Authorization", "Bearer scrub-token")
                .multiPart("file", "me.jpg", generateJpeg(320, 240), "image/jpeg")
                .when().post("/users/me/avatar")
                .then().statusCode(200)
                .extract().path("avatarUrl");
        String storageKey = avatarUrl.substring("/uploads/".length());

        given().basePath("").header("Authorization", "Bearer scrub-token")
                .when().get("/uploads/" + storageKey)
                .then().statusCode(200);

        given().header("Authorization", "Bearer scrub-token")
                .when().delete("/users/me")
                .then().statusCode(204);

        User deleted = users.findById(user.getId()).orElseThrow();
        assertThat(deleted.getEmail()).isEmpty();
        assertThat(deleted.isEmailVerified()).isFalse();
        assertThat(deleted.getPhone()).isNull();
        assertThat(deleted.isPhoneVerified()).isFalse();
        assertThat(deleted.getFirstName()).isNull();
        assertThat(deleted.getDisplayName()).isEqualTo("Utilisateur supprimé");
        assertThat(deleted.getCity()).isNull();
        assertThat(deleted.getBio()).isNull();
        assertThat(deleted.getAvatarUrl()).isNull();

        // The file itself, not just the row's pointer to it, must be gone.
        given().basePath("").when().get("/uploads/" + storageKey)
                .then().statusCode(404);
    }

    @Test
    @DisplayName("a deleted account's email can be used to register again")
    void deletedEmailCanRegisterAgain() throws Exception {
        String email = "reuse-" + System.nanoTime() + "@example.ma";
        String firstUid = "uid-reuse-first-" + System.nanoTime();
        stubToken(firstUid, email, true);
        users.saveAndFlush(new User(firstUid, email, true, "First Life"));

        given().header("Authorization", "Bearer reuse-token")
                .when().delete("/users/me")
                .then().statusCode(204);

        // Signing up again produces a brand new Firebase uid with the same
        // address. Before V14 the unique index on lower(email) covered
        // soft-deleted rows too, so this failed with a constraint violation the
        // person had no way to resolve -- deleting an account burned the email.
        String secondUid = "uid-reuse-second-" + System.nanoTime();
        stubToken(secondUid, email, true);

        given().header("Authorization", "Bearer reuse-token-2")
                .contentType("application/json")
                .body("{\"displayName\":\"Second Life\"}")
                .when().post("/users")
                .then().statusCode(201)
                .body("displayName", equalTo("Second Life"));
    }

    private byte[] generateJpeg(int width, int height) {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, width, height);
            graphics.setColor(new Color(125, 75, 50));
            graphics.fillRect(20, 20, width - 40, height - 40);
        } finally {
            graphics.dispose();
        }
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(image, "jpg", out);
            return out.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Could not generate test image", ex);
        }
    }
}
