package ma.dari.api.listing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.UUID;

/**
 * Produces one stable, secret-keyed public location offset per listing.
 *
 * <p>The public listing id alone must never be enough to reconstruct the
 * offset. Re-randomising on each request would also be unsafe: callers could
 * average public pins back to the exact location.
 */
@Component
public class LocationFuzzer {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final SecretKeySpec key;

    public LocationFuzzer(@Value("${dari.location.fuzz-secret}") String fuzzSecret) {
        this.key = new SecretKeySpec(fuzzSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
    }

    public double[] fuzz(UUID listingId, double latitude, double longitude, double radiusMetres) {
        byte[] digest = digest(listingId);
        double angle = unitInterval(digest, 0) * 2.0 * Math.PI;
        // sqrt transforms a uniform area sample into a uniform-disc sample.
        double distance = Math.sqrt(unitInterval(digest, 8)) * radiusMetres;

        double latitudeOffset = (distance * Math.cos(angle)) / 111_320.0;
        double longitudeOffset = (distance * Math.sin(angle))
                / (111_320.0 * Math.cos(Math.toRadians(latitude)));

        return new double[] { latitude + latitudeOffset, longitude + longitudeOffset };
    }

    private byte[] digest(UUID listingId) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(key);
            return mac.doFinal(listingId.toString().getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException impossible) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable", impossible);
        }
    }

    /** Maps eight digest bytes to [0, 1) without bias from signed Java bytes. */
    private static double unitInterval(byte[] digest, int offset) {
        long bits = 0;
        for (int index = offset; index < offset + Long.BYTES; index++) {
            bits = (bits << Byte.SIZE) | (digest[index] & 0xffL);
        }
        return (bits >>> 11) * 0x1.0p-53;
    }
}
