package ma.dari.api.listing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ListingPhotoRepository extends JpaRepository<ListingPhoto, UUID> {
    List<ListingPhoto> findByListingIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAsc(UUID listingId);

    Optional<ListingPhoto> findByIdAndListingIdAndDeletedAtIsNull(UUID photoId, UUID listingId);

    Optional<ListingPhoto> findByListingIdAndCoverTrueAndDeletedAtIsNull(UUID listingId);
}
