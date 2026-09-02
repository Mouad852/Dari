package ma.dari.api.listing;

import java.util.Random;
import java.util.UUID;

public final class LocationFuzzer {

    private static final double RADIUS_M = 200.0;

    private LocationFuzzer() {
    }

    public static double[] fuzz(UUID listingId, double lat, double lng) {
        long seed = listingId.getMostSignificantBits() ^ listingId.getLeastSignificantBits();
        Random random = new Random(seed);

        double angle = random.nextDouble() * 2 * Math.PI;
        double distance = Math.sqrt(random.nextDouble()) * RADIUS_M;

        double dLat = (distance * Math.cos(angle)) / 111_320.0;
        double dLng = (distance * Math.sin(angle)) / (111_320.0 * Math.cos(Math.toRadians(lat)));

        return new double[] { lat + dLat, lng + dLng };
    }
}
