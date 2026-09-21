package ma.dari.api.media;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.UUID;

/** S3-compatible adapter for MinIO and production object storage. */
@Component
@ConditionalOnProperty(name = "dari.media.provider", havingValue = "s3")
public class S3ImageStore implements ImageStore {
    private static final Logger log = LoggerFactory.getLogger(S3ImageStore.class);
    private static final DateTimeFormatter AMZ_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter AMZ_DATE = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);
    private final HttpClient client = HttpClient.newHttpClient();
    private final URI endpoint;
    private final String region;
    private final String accessKey;
    private final String secretKey;
    private final String bucket;
    private final String publicBaseUrl;

    public S3ImageStore(@Value("${dari.media.s3.endpoint:}") String endpoint,
                        @Value("${dari.media.s3.region:eu-west-1}") String region,
                        @Value("${dari.media.s3.access-key}") String accessKey,
                        @Value("${dari.media.s3.secret-key}") String secretKey,
                        @Value("${dari.media.s3.bucket}") String bucket,
                        @Value("${dari.media.public-base-url}") String publicBaseUrl) {
        this.endpoint = URI.create(endpoint == null || endpoint.isBlank() ? "https://s3." + region + ".amazonaws.com" : endpoint);
        this.region = region;
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.bucket = bucket;
        this.publicBaseUrl = publicBaseUrl == null ? "" : publicBaseUrl.replaceAll("/+$", "");
    }

    @Override
    public StoredImage store(String folder, UUID ownerId, MultipartFile file) {
        ImageProcessor.EncodedImage encoded = ImageProcessor.process(file);
        String key = folder + "/" + ownerId + "/" + UUID.randomUUID() + ".jpg";
        try {
            HttpResponse<String> response = request("PUT", key, encoded.bytes(), encoded.mimeType());
            if (response.statusCode() >= 400) throw new IllegalStateException("S3 returned HTTP " + response.statusCode());
            return new StoredImage(key, encoded.mimeType(), encoded.width(), encoded.height());
        } catch (Exception failure) {
            log.warn("S3 image upload failed ({})", failure.getMessage());
            throw new ApiException(503, ErrorCode.INTERNAL_ERROR, "L'enregistrement de la photo a échoué");
        }
    }

    @Override
    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;
        try {
            HttpResponse<String> response = request("DELETE", storageKey, new byte[0], null);
            if (response.statusCode() >= 400 && response.statusCode() != 404) throw new IllegalStateException("S3 returned HTTP " + response.statusCode());
        } catch (Exception failure) {
            log.warn("S3 image deletion failed ({})", failure.getMessage());
            throw new ApiException(503, ErrorCode.INTERNAL_ERROR, "La suppression de la photo a échoué");
        }
    }

    @Override
    public String publicUrl(String storageKey) {
        return publicBaseUrl + "/" + storageKey;
    }

    private HttpResponse<String> request(String method, String key, byte[] body, String contentType) throws Exception {
        byte[] payload = body == null ? new byte[0] : body;
        Instant now = Instant.now();
        String amzTime = AMZ_TIME.format(now);
        String amzDate = AMZ_DATE.format(now);
        String canonicalUri = "/" + bucket + "/" + key.replace(" ", "%20");
        String host = endpoint.getAuthority();
        String payloadHash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload));
        String canonicalHeaders = "host:" + host + "\n" +
                "x-amz-content-sha256:" + payloadHash + "\n" + "x-amz-date:" + amzTime + "\n";
        String signedHeaders = "host;x-amz-content-sha256;x-amz-date";
        String canonicalRequest = method + "\n" + canonicalUri + "\n\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + payloadHash;
        String scope = amzDate + "/" + region + "/s3/aws4_request";
        String stringToSign = "AWS4-HMAC-SHA256\n" + amzTime + "\n" + scope + "\n" + sha256(canonicalRequest);
        String signature = HexFormat.of().formatHex(hmac(signingKey(amzDate), stringToSign));
        HttpRequest.Builder request = HttpRequest.newBuilder(endpoint.resolve(canonicalUri))
                .method(method, HttpRequest.BodyPublishers.ofByteArray(payload))
                .header("x-amz-date", amzTime)
                .header("x-amz-content-sha256", payloadHash)
                .header("Authorization", "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + scope
                        + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature);
        if (contentType != null) request.header("Content-Type", contentType);
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private byte[] signingKey(String date) throws Exception {
        return hmac(hmac(hmac(hmac(("AWS4" + secretKey).getBytes(StandardCharsets.UTF_8), date), region), "s3"), "aws4_request");
    }

    private static byte[] hmac(byte[] key, String value) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String sha256(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}
