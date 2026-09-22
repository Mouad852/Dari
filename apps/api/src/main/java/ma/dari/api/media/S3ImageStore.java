package ma.dari.api.media;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.util.UUID;

/**
 * S3-compatible adapter for MinIO and production object storage.
 *
 * <p>Every call is bounded: a connect timeout on the client, a request timeout
 * on each request, and at most one retry. Worst case for one PUT or DELETE is
 * therefore {@code 2 * (connect + request) + RETRY_BACKOFF}, 24.2 s with the
 * defaults. Uploads run on a servlet thread and cleanup runs inside a
 * scheduler lock, so an unbounded call would hold either indefinitely.
 */
@Component
@ConditionalOnProperty(name = "dari.media.provider", havingValue = "s3")
public class S3ImageStore implements ImageStore {
    private static final Logger log = LoggerFactory.getLogger(S3ImageStore.class);
    private static final DateTimeFormatter AMZ_TIME = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter AMZ_DATE = DateTimeFormatter.ofPattern("yyyyMMdd").withZone(ZoneOffset.UTC);

    /**
     * One retry, for PUT and DELETE alike. Both are idempotent here: a PUT
     * writes a key that is a fresh random UUID nobody else can have written,
     * and deleting an absent key is a success.
     */
    static final int MAX_ATTEMPTS = 2;
    static final Duration RETRY_BACKOFF = Duration.ofMillis(200);

    private final HttpClient client;
    private final Duration requestTimeout;
    private final String cacheControl;
    private final Clock clock;
    private final URI endpoint;
    private final String region;
    private final String accessKey;
    private final String secretKey;
    private final String bucket;
    private final String publicBaseUrl;

    @Autowired
    public S3ImageStore(@Value("${dari.media.s3.endpoint:}") String endpoint,
                        @Value("${dari.media.s3.region:eu-west-1}") String region,
                        @Value("${dari.media.s3.access-key}") String accessKey,
                        @Value("${dari.media.s3.secret-key}") String secretKey,
                        @Value("${dari.media.s3.bucket}") String bucket,
                        @Value("${dari.media.public-base-url}") String publicBaseUrl,
                        @Value("${dari.media.s3.connect-timeout-ms:2000}") long connectTimeoutMs,
                        @Value("${dari.media.s3.request-timeout-ms:10000}") long requestTimeoutMs,
                        @Value("${dari.media.s3.cache-control:public, max-age=3600}") String cacheControl) {
        // The system clock, never the application Clock bean: a signature is
        // only valid within minutes of the storage server's own time.
        this(endpoint, region, accessKey, secretKey, bucket, publicBaseUrl,
                Duration.ofMillis(connectTimeoutMs), Duration.ofMillis(requestTimeoutMs), cacheControl,
                Clock.systemUTC());
    }

    S3ImageStore(String endpoint, String region, String accessKey, String secretKey, String bucket,
                 String publicBaseUrl, Duration connectTimeout, Duration requestTimeout, String cacheControl,
                 Clock clock) {
        this.endpoint = URI.create(endpoint == null || endpoint.isBlank() ? "https://s3." + region + ".amazonaws.com" : endpoint);
        this.region = region;
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.bucket = bucket;
        this.publicBaseUrl = publicBaseUrl == null ? "" : publicBaseUrl.replaceAll("/+$", "");
        this.client = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
        this.requestTimeout = requestTimeout;
        this.cacheControl = cacheControl;
        this.clock = clock;
    }

    @Override
    public StoredImage store(String folder, UUID ownerId, MultipartFile file) {
        ImageProcessor.EncodedImage encoded = ImageProcessor.process(file);
        String key = folder + "/" + ownerId + "/" + UUID.randomUUID() + ".jpg";
        String failure = call("PUT", key, encoded.bytes(), encoded.mimeType(), false);
        if (failure != null) {
            log.warn("S3 image upload failed ({})", failure);
            throw new ApiException(503, ErrorCode.INTERNAL_ERROR, "L'enregistrement de la photo a échoué",
                    new IllegalStateException("S3 PUT failed: " + failure));
        }
        return new StoredImage(key, encoded.mimeType(), encoded.width(), encoded.height());
    }

    @Override
    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;
        String failure = call("DELETE", storageKey, new byte[0], null, true);
        if (failure != null) {
            log.warn("S3 image deletion failed ({})", failure);
            throw new ApiException(503, ErrorCode.INTERNAL_ERROR, "La suppression de la photo a échoué",
                    new IllegalStateException("S3 DELETE failed: " + failure));
        }
    }

    @Override
    public String publicUrl(String storageKey) {
        return publicBaseUrl + "/" + storageKey;
    }

    /**
     * Sends one request with at most one retry, and returns null on success or
     * a short reason on failure. The reason is a status code or an exception
     * class and message; S3 error bodies are never read, so nothing the server
     * echoes back (request ids, signature details) can reach a log line.
     */
    private String call(String method, String key, byte[] body, String contentType, boolean notFoundIsSuccess) {
        for (int attempt = 1; ; attempt++) {
            String failure;
            boolean retryable;
            try {
                int status = client.send(signedRequest(method, key, body, contentType),
                        HttpResponse.BodyHandlers.discarding()).statusCode();
                if (status / 100 == 2 || (notFoundIsSuccess && status == 404)) return null;
                failure = "HTTP " + status;
                // A 4xx is a decision the server will make again (bad signature,
                // missing bucket, access denied); a 3xx is a wrong-region or
                // endpoint redirect, which the client never follows. Neither
                // gets better by repeating.
                retryable = status >= 500;
            } catch (IOException transientFailure) {
                // Includes HttpConnectTimeoutException and HttpTimeoutException.
                failure = transientFailure.getClass().getSimpleName() + ": " + transientFailure.getMessage();
                retryable = true;
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                return "interrupted";
            }
            if (!retryable || attempt == MAX_ATTEMPTS) return failure;
            log.info("S3 {} attempt {} failed ({}); retrying", method, attempt, failure);
            try {
                Thread.sleep(RETRY_BACKOFF);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                return "interrupted";
            }
        }
    }

    /** Signs afresh on every attempt, so a retry carries its own x-amz-date. */
    private HttpRequest signedRequest(String method, String key, byte[] body, String contentType) {
        try {
            byte[] payload = body == null ? new byte[0] : body;
            Instant now = clock.instant();
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
            // No Host header here: HttpClient sets it from the URI, which is
            // exactly the authority signed above.
            HttpRequest.Builder request = HttpRequest.newBuilder(endpoint.resolve(canonicalUri))
                    .timeout(requestTimeout)
                    .method(method, HttpRequest.BodyPublishers.ofByteArray(payload))
                    .header("x-amz-date", amzTime)
                    .header("x-amz-content-sha256", payloadHash)
                    .header("Authorization", "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + scope
                            + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature);
            if (contentType != null) request.header("Content-Type", contentType);
            // Stored as object metadata and served by S3/CloudFront on every
            // read. Not an x-amz-* header, so SigV4 does not require signing it.
            // Its max-age bounds how long a deleted photo can stay cached.
            if ("PUT".equals(method) && cacheControl != null && !cacheControl.isBlank()) {
                request.header("Cache-Control", cacheControl);
            }
            return request.build();
        } catch (GeneralSecurityException impossible) {
            throw new IllegalStateException("SHA-256/HmacSHA256 unavailable", impossible);
        }
    }

    private byte[] signingKey(String date) throws GeneralSecurityException {
        return hmac(hmac(hmac(hmac(("AWS4" + secretKey).getBytes(StandardCharsets.UTF_8), date), region), "s3"), "aws4_request");
    }

    private static byte[] hmac(byte[] key, String value) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String sha256(String value) throws GeneralSecurityException {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}
