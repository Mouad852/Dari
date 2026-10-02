package ma.dari.api.listing;

import ma.dari.api.media.MediaCleanupService;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Takes all of an owner's listings off Dari for good: each one SUSPENDED and
 * soft-deleted, and each photo revoked and queued for physical deletion.
 * Shared by account deletion and a ban (audit P2-6), so a banned owner's
 * photos stop being served as soon as the ban commits. Runs inside the
 * caller's transaction.
 */
@Component
public class OwnerListingsRemoval {

    private final ListingRepository listings;
    private final ListingPhotoRepository listingPhotos;
    private final MediaCleanupService mediaCleanup;

    public OwnerListingsRemoval(ListingRepository listings, ListingPhotoRepository listingPhotos,
                                MediaCleanupService mediaCleanup) {
        this.listings = listings;
        this.listingPhotos = listingPhotos;
        this.mediaCleanup = mediaCleanup;
    }

    public void removeAll(UUID ownerId, Instant now) {
        listings.findByOwnerId(ownerId).forEach(listing -> {
            if (listing.getDeletedAt() == null) {
                listingPhotos.findByListingIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAsc(listing.getId())
                        .forEach(photo -> {
                            photo.setDeletedAt(now);
                            mediaCleanup.enqueue(photo.getStorageKey());
                            listingPhotos.save(photo);
                        });
                listing.setStatus(ListingStatus.SUSPENDED);
                listing.setDeletedAt(now);
                listings.save(listing);
            }
        });
    }
}
