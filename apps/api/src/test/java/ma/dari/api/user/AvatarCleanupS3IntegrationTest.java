package ma.dari.api.user;

import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.media.MediaCleanupService;
import ma.dari.api.support.AbstractJobIntegrationTest;
import ma.dari.api.support.TestMinio;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;

/**
 * The erasure guarantee in the storage mode production runs: S3, behind an
 * absolute public base URL that shares no prefix with {@code /uploads/}.
 *
 * <p>Before the stored key replaced the stored URL, both replacement and
 * deletion enqueued nothing here, and the object stayed public in the bucket.
 * The objects are checked in MinIO itself, not through the client under test.
 */
class AvatarCleanupS3IntegrationTest extends AbstractJobIntegrationTest {

    private static final String PUBLIC_BASE_URL = "https://cdn.test.invalid/media";
    private static final TestMinio MINIO = TestMinio.start("dari-avatars-it");

    @DynamicPropertySource
    static void s3(DynamicPropertyRegistry registry) {
        registry.add("dari.media.provider", () -> "s3");
        registry.add("dari.media.public-base-url", () -> PUBLIC_BASE_URL);
        registry.add("dari.media.s3.endpoint", MINIO::endpoint);
        registry.add("dari.media.s3.region", () -> TestMinio.REGION);
        registry.add("dari.media.s3.bucket", MINIO::bucket);
        registry.add("dari.media.s3.access-key", () -> TestMinio.ACCESS_KEY);
        registry.add("dari.media.s3.secret-key", () -> TestMinio.SECRET_KEY);
    }

    @AfterAll
    static void stopMinio() {
        MINIO.close();
    }

    @Autowired
    UserRepository users;

    @Autowired
    MediaCleanupService mediaCleanup;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void replacementAndDeletionEnqueueTheStoredKeysAndTheWorkerDeletesTheObjects() throws Exception {
        String uid = "uid-avatar-s3-" + System.nanoTime();
        stubToken(uid);
        User user = users.saveAndFlush(new User(uid, uid + "@example.ma", true, "Avatar S3"));

        String firstUrl = uploadAvatar();
        assertThat(firstUrl).matches(PUBLIC_BASE_URL + "/avatars/" + user.getId() + "/[0-9a-f-]{36}\\.jpg");
        String firstKey = keyOf(firstUrl);
        assertThat(MINIO.exists(firstKey)).isTrue();
        assertThat(users.findById(user.getId()).orElseThrow().getAvatarStorageKey()).isEqualTo(firstKey);
        given().when().get("/users/{id}", user.getId())
                .then().statusCode(200).body("avatarUrl", equalTo(firstUrl));

        String secondKey = keyOf(uploadAvatar());
        assertThat(cleanupStatus(firstKey)).isEqualTo("PENDING");

        mediaCleanup.processDue();
        assertThat(cleanupStatus(firstKey)).isEqualTo("DELETED");
        assertThat(MINIO.exists(firstKey)).as("the replaced avatar is gone from the bucket").isFalse();
        assertThat(MINIO.exists(secondKey)).isTrue();

        given().header("Authorization", "Bearer avatar-s3").when().delete("/users/me")
                .then().statusCode(204);
        assertThat(cleanupStatus(secondKey)).isEqualTo("PENDING");

        mediaCleanup.processDue();
        assertThat(cleanupStatus(secondKey)).isEqualTo("DELETED");
        assertThat(MINIO.exists(secondKey)).as("a deleted account's avatar is gone from the bucket").isFalse();
    }

    private static String keyOf(String publicUrl) {
        return publicUrl.substring(PUBLIC_BASE_URL.length() + 1);
    }

    private String uploadAvatar() {
        return given().header("Authorization", "Bearer avatar-s3")
                .multiPart("file", "me.jpg", AvatarCleanupLocalIntegrationTest.jpeg(), "image/jpeg")
                .when().post("/users/me/avatar")
                .then().statusCode(200)
                .extract().path("avatarUrl");
    }

    private String cleanupStatus(String storageKey) {
        return jdbc.queryForObject("SELECT status FROM media_cleanup WHERE storage_key = ?", String.class, storageKey);
    }

    private void stubToken(String uid) throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(uid + "@example.ma");
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);
    }
}
