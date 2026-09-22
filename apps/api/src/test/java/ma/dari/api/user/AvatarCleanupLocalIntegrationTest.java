package ma.dari.api.user;

import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.media.MediaCleanupService;
import ma.dari.api.support.AbstractJobIntegrationTest;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Path;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;

/**
 * Avatar replacement and account deletion in local storage mode: the stored
 * key is enqueued directly, revoked immediately, and the worker removes the
 * file. The S3 half of the same guarantee is {@code AvatarCleanupS3IntegrationTest}.
 */
class AvatarCleanupLocalIntegrationTest extends AbstractJobIntegrationTest {

    @Autowired
    UserRepository users;

    @Autowired
    MediaCleanupService mediaCleanup;

    @Autowired
    JdbcTemplate jdbc;

    @Value("${dari.upload-dir:./uploads}")
    String uploadDir;

    @Test
    void replacementAndDeletionEnqueueTheStoredKeysAndTheWorkerRemovesTheFiles() throws Exception {
        String uid = "uid-avatar-local-" + System.nanoTime();
        stubToken(uid);
        User user = users.saveAndFlush(new User(uid, uid + "@example.ma", true, "Avatar Local"));

        String firstUrl = uploadAvatar();
        assertThat(firstUrl).matches("/uploads/avatars/" + user.getId() + "/[0-9a-f-]{36}\\.jpg");
        String firstKey = firstUrl.substring("/uploads/".length());
        User stored = users.findById(user.getId()).orElseThrow();
        assertThat(stored.getAvatarStorageKey()).isEqualTo(firstKey);
        assertThat(stored.getAvatarUrl()).as("the legacy column is no longer written").isNull();
        given().basePath("").when().get(firstUrl).then().statusCode(200);
        given().when().get("/users/{id}", user.getId())
                .then().statusCode(200).body("avatarUrl", equalTo(firstUrl));

        String secondUrl = uploadAvatar();
        String secondKey = secondUrl.substring("/uploads/".length());
        assertThat(cleanupStatus(firstKey)).isEqualTo("PENDING");
        given().basePath("").when().get(firstUrl).then().statusCode(404);
        given().basePath("").when().get(secondUrl).then().statusCode(200);

        mediaCleanup.processDue();
        assertThat(cleanupStatus(firstKey)).isEqualTo("DELETED");
        assertThat(file(firstKey)).doesNotExist();
        assertThat(file(secondKey)).exists();

        given().header("Authorization", "Bearer avatar-local").when().delete("/users/me")
                .then().statusCode(204);
        assertThat(cleanupStatus(secondKey)).isEqualTo("PENDING");
        assertThat(users.findById(user.getId()).orElseThrow().getAvatarStorageKey()).isNull();
        given().basePath("").when().get(secondUrl).then().statusCode(404);

        mediaCleanup.processDue();
        assertThat(cleanupStatus(secondKey)).isEqualTo("DELETED");
        assertThat(file(secondKey)).doesNotExist();
    }

    private String uploadAvatar() {
        return given().header("Authorization", "Bearer avatar-local")
                .multiPart("file", "me.jpg", jpeg(), "image/jpeg")
                .when().post("/users/me/avatar")
                .then().statusCode(200)
                .extract().path("avatarUrl");
    }

    private String cleanupStatus(String storageKey) {
        return jdbc.queryForObject("SELECT status FROM media_cleanup WHERE storage_key = ?", String.class, storageKey);
    }

    private Path file(String storageKey) {
        return Path.of(uploadDir).toAbsolutePath().normalize().resolve(storageKey);
    }

    private void stubToken(String uid) throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(uid + "@example.ma");
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);
    }

    static byte[] jpeg() {
        BufferedImage image = new BufferedImage(240, 200, BufferedImage.TYPE_INT_RGB);
        var graphics = image.createGraphics();
        try {
            graphics.setColor(new Color(125, 75, 50));
            graphics.fillRect(0, 0, 240, 200);
        } finally {
            graphics.dispose();
        }
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(image, "jpg", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
