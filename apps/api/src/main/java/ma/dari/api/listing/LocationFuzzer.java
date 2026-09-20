package ma.dari.api.listing;

import java.util.Random;
import java.util.UUID;

public final class LocationFuzzer {

    private static final double DEFAULT_RADIUS_M = 200.0;

    private LocationFuzzer() {
    }

    public static double[] fuzz(UUID listingId, double lat, double lng) {
        return fuzz(listingId, lat, lng, DEFAULT_RADIUS_M);
    }

    public static double[] fuzz(UUID listingId, double lat, double lng, double radiusM) {
        long seed = listingId.getMostSignificantBits() ^ listingId.getLeastSignificantBits();
        Random random = new Random(seed);

        double angle = random.nextDouble() * 2 * Math.PI;
        double distance = Math.sqrt(random.nextDouble()) * radiusM;

        double dLat = (distance * Math.cos(angle)) / 111_320.0;
        double dLng = (distance * Math.sin(angle)) / (111_320.0 * Math.cos(Math.toRadians(lat)));

        return new double[] { lat + dLat, lng + dLng };
    }
}
