package ma.dari.api.listing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ListingRoomRepository extends JpaRepository<ListingRoom, UUID> {

    List<ListingRoom> findByListingIdOrderByCreatedAtAsc(UUID listingId);

    /** Rooms of many listings at once, each listing's in creation order (ListingExtras). */
    List<ListingRoom> findByListingIdInOrderByCreatedAtAsc(Collection<UUID> listingIds);

    /** Full replace, same as amenities: the wizard step submits the whole room list every time. */
    @Modifying
    @Query("delete from ListingRoom r where r.listing.id = :listingId")
    void deleteByListingId(@Param("listingId") UUID listingId);
}
