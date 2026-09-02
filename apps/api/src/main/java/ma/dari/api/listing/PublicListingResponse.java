package ma.dari.api.listing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PublicListingResponse(
        UUID id,
        String title,
        String city,
        String neighborhood,
        BigDecimal priceRent,
        double latitude,
        double longitude,
        ListingStatus status,
        AvailabilityState availabilityState,
        Instant createdAt) {

    public static PublicListingResponse from(Listing listing, double[] fuzzed) {
        return new PublicListingResponse(
                listing.getId(),
                listing.getTitle(),
                listing.getCity(),
                listing.getNeighborhood(),
                listing.getPriceRent(),
                fuzzed[0],
                fuzzed[1],
                listing.getStatus(),
                listing.getAvailabilityState(),
                listing.getCreatedAt());
    }
}
