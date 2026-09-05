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
        AvailabilityState availabilityState,
        Instant createdAt,
        /**
         * Root-relative URL of the cover photo, or null when the listing has
         * none. Prefix with the API origin before use — these are served by the
         * API, not the web app.
         */
        String coverPhotoUrl) {

    /**
     * @param coverPhotoUrl may be null, but pass it deliberately.
     *
     * <p>There is no convenience overload that omits it. Search results without
     * photos were shipped for months precisely because this DTO had no way to
     * carry one, and an overload defaulting to null would let the next caller
     * reintroduce that silently rather than having to decide.
     */
    public static PublicListingResponse from(Listing listing, double[] fuzzed, String coverPhotoUrl) {
        return new PublicListingResponse(
                listing.getId(),
                listing.getTitle(),
                listing.getCity(),
                listing.getNeighborhood(),
                listing.getPriceRent(),
                fuzzed[0],
                fuzzed[1],
                listing.getAvailabilityState(),
                listing.getCreatedAt(),
                coverPhotoUrl);
    }
}
