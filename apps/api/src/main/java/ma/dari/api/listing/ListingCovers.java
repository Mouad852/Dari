package ma.dari.api.listing;

import ma.dari.api.listing.dto.ListingPhotoResponse;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The cover photo URL for a listing, in one place.
 *
 * <p>This existed three times as private helpers inside {@code ListingSearchService},
 * and not at all in {@code AdminService} or {@code ListingService} — which is why
 * the moderation queue and the owner's own list showed a placeholder for listings
 * that had a real photograph. Extracted rather than copied a fourth and fifth
 * time.
 *
 * <p>{@link #forEach(List)} exists because the single-listing lookup in a loop is
 * a query per row. Any list endpoint should use it; the single-id form is for
 * the detail and lifecycle responses, where there is exactly one listing.
 */
@Component
public class ListingCovers {

    private final ListingPhotoRepository photos;

    public ListingCovers(ListingPhotoRepository photos) {
        this.photos = photos;
    }

    /** Root-relative URL, or null when the listing has no cover photo. */
    public String forListing(UUID listingId) {
        return photos.findByListingIdAndCoverTrueAndDeletedAtIsNull(listingId)
                .map(photo -> ListingPhotoResponse.from(photo).url())
                .orElse(null);
    }

    /**
     * One query for the whole page. Listings without a cover are simply absent
     * from the map, so callers should read it with {@code map.get(id)} and let a
     * null mean "no photo".
     */
    public Map<UUID, String> forEach(List<Listing> rows) {
        if (rows.isEmpty()) {
            return Map.of();
        }
        List<UUID> ids = rows.stream().map(Listing::getId).toList();
        Map<UUID, String> urls = new HashMap<>();
        for (ListingPhoto photo : photos.findByListingIdInAndCoverTrueAndDeletedAtIsNull(ids)) {
            urls.put(photo.getListing().getId(), ListingPhotoResponse.from(photo).url());
        }
        return urls;
    }
}
