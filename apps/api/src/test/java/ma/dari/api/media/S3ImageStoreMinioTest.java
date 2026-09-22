package ma.dari.api.media;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import ma.dari.api.common.error.ApiException;
import ma.dari.api.support.TestMinio;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * S3ImageStore signs its own requests (SigV4 over java.net.http), and was
 * broken until 8491a6e with nothing to notice. MinIO verifies the signatures
 * the way S3 does, so a round trip here is the regression test for that.
 */
class S3ImageStoreMinioTest {

    private static final String CACHE_CONTROL = "public, max-age=3600";
    private static TestMinio minio;

    @BeforeAll
    static void startMinio() {
        minio = TestMinio.start("dari-store-it");
    }

    @AfterAll
    static void stopMinio() {
        minio.close();
    }

    @Test
    void signedPutReadAndDeleteRoundTrip() throws Exception {
        S3ImageStore store = store(TestMinio.SECRET_KEY);

        ImageStore.StoredImage stored = store.store(ImageStore.LISTINGS, UUID.randomUUID(), photo());
        assertThat(minio.exists(stored.storageKey())).isTrue();
        assertThat(store.publicUrl(stored.storageKey())).isEqualTo("https://cdn.test.invalid/" + stored.storageKey());

        HttpResponse<byte[]> read = anonymousGet(stored.storageKey());
        assertThat(read.statusCode()).isEqualTo(200);
        assertThat(read.headers().firstValue("Cache-Control")).contains(CACHE_CONTROL);
        assertThat(read.headers().firstValue("Content-Type")).contains("image/jpeg");
        assertThat(ImageIO.read(new ByteArrayInputStream(read.body()))).isNotNull();

        store.delete(stored.storageKey());
        assertThat(minio.exists(stored.storageKey())).isFalse();
        assertThat(anonymousGet(stored.storageKey()).statusCode()).isEqualTo(404);

        // Deleting an absent key is success, which is what makes cleanup retries safe.
        store.delete(stored.storageKey());
    }

    @Test
    void aWrongSecretKeyIsA503ThatNamesNoSecret() throws Exception {
        String wrongSecret = "wrong-secret-" + UUID.randomUUID();
        Logger logger = (Logger) LoggerFactory.getLogger(S3ImageStore.class);
        ListAppender<ILoggingEvent> logs = new ListAppender<>();
        logs.start();
        logger.addAppender(logs);
        try {
            S3ImageStore store = store(wrongSecret);

            ApiException upload = catchThrowableOfType(ApiException.class,
                    () -> store.store(ImageStore.LISTINGS, UUID.randomUUID(), photo()));
            assertThat(upload.status()).isEqualTo(503);
            assertThat(upload.getMessage()).isEqualTo("L'enregistrement de la photo a échoué");
            assertThat(upload.getCause()).hasMessage("S3 PUT failed: HTTP 403");

            ApiException deletion = catchThrowableOfType(ApiException.class,
                    () -> store.delete("listings/" + UUID.randomUUID() + "/absent.jpg"));
            assertThat(deletion.status()).isEqualTo(503);
            assertThat(deletion.getCause()).hasMessage("S3 DELETE failed: HTTP 403");

            for (Throwable failure : new Throwable[] {upload, upload.getCause(), deletion, deletion.getCause()}) {
                assertThat(failure.getMessage()).doesNotContain(wrongSecret).doesNotContain(TestMinio.SECRET_KEY);
            }
            assertThat(logs.list).isNotEmpty().allSatisfy(event -> assertThat(event.getFormattedMessage())
                    .doesNotContain(wrongSecret)
                    .doesNotContain(TestMinio.SECRET_KEY)
                    // The S3 error body (SignatureDoesNotMatch, the canonical
                    // request, the request id) is never read, so never logged.
                    .doesNotContain("SignatureDoesNotMatch"));
        } finally {
            logger.detachAppender(logs);
        }
    }

    private static S3ImageStore store(String secretKey) {
        return new S3ImageStore(minio.endpoint(), TestMinio.REGION, TestMinio.ACCESS_KEY, secretKey,
                minio.bucket(), "https://cdn.test.invalid/", Duration.ofSeconds(2), Duration.ofSeconds(10),
                CACHE_CONTROL, Clock.systemUTC());
    }

    private static HttpResponse<byte[]> anonymousGet(String key) throws Exception {
        return HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(minio.endpoint() + "/" + minio.bucket() + "/" + key)).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray());
    }

    static MockMultipartFile photo() throws Exception {
        BufferedImage image = new BufferedImage(240, 200, BufferedImage.TYPE_INT_RGB);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(image, "jpg", out);
            return new MockMultipartFile("file", "photo.jpg", "image/jpeg", out.toByteArray());
        }
    }
}
