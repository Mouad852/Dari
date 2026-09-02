package ma.dari.api.listing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ListingAmenityRepository extends JpaRepository<ListingAmenity, ListingAmenity.ListingAmenityId> {

    @Query("select la.amenityCode from ListingAmenity la where la.listing.id = :listingId")
    List<String> findAmenityCodesByListingId(@Param("listingId") UUID listingId);

    @Modifying
    @Query("delete from ListingAmenity la where la.listing.id = :listingId")
    void deleteByListingId(@Param("listingId") UUID listingId);
}
