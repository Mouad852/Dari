package ma.dari.api.listing;

import java.util.UUID;

public record MapPinResponse(
        UUID id,
        String title,
        String city,
        String neighborhood,
        double latitude,
        double longitude
) {
    public static MapPinResponse from(Listing listing, double[] fuzzed) {
        return new MapPinResponse(
                listing.getId(),
                listing.getTitle(),
                listing.getCity(),
                listing.getNeighborhood(),
                fuzzed[0],
                fuzzed[1]
        );
    }
}
