package ma.dari.api.listing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ListingPhotoRepository extends JpaRepository<ListingPhoto, UUID> {
    List<ListingPhoto> findByListingIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAsc(UUID listingId);

    Optional<ListingPhoto> findByIdAndListingIdAndDeletedAtIsNull(UUID photoId, UUID listingId);

    Optional<ListingPhoto> findByListingIdAndCoverTrueAndDeletedAtIsNull(UUID listingId);

    /**
     * Cover photos for a whole page of listings in one query.
     *
     * <p>Search returns twenty listings at a time. Resolving each one's cover
     * individually would be twenty round trips per page, on the busiest endpoint
     * in the product — the reason this takes a collection rather than reusing
     * the single-listing lookup above.
     */
    List<ListingPhoto> findByListingIdInAndCoverTrueAndDeletedAtIsNull(Collection<UUID> listingIds);
}
