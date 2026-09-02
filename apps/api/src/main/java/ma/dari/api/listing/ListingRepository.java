package ma.dari.api.listing;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ListingRepository extends JpaRepository<Listing, UUID> {
    List<Listing> findByStatusAndAvailabilityStateAndDeletedAtIsNull(
            ListingStatus status,
            AvailabilityState availabilityState);

    List<Listing> findByStatus(ListingStatus status);

    List<Listing> findByOwnerId(UUID ownerId);

    Optional<Listing> findByIdAndOwnerIdAndDeletedAtIsNull(UUID id, UUID ownerId);

    Optional<Listing> findFirstByOwnerIdAndStatusAndDeletedAtIsNullOrderByUpdatedAtDesc(
            UUID ownerId, ListingStatus status);

    Optional<Listing> findByIdAndDeletedAtIsNull(UUID id);

    /** The owner's own dashboard: every status, oldest hidden behind the cursor. */
    @Query("select l from Listing l where l.owner.id = :ownerId and l.deletedAt is null order by l.createdAt desc, l.id desc")
    List<Listing> findVisibleByOwner(@Param("ownerId") UUID ownerId, Pageable pageable);

    @Query("""
            select l from Listing l
            where l.owner.id = :ownerId and l.deletedAt is null
              and (l.createdAt < :lastCreatedAt or (l.createdAt = :lastCreatedAt and l.id < :lastId))
            order by l.createdAt desc, l.id desc
            """)
    List<Listing> findVisibleByOwnerAfter(@Param("ownerId") UUID ownerId,
                                          @Param("lastCreatedAt") Instant lastCreatedAt,
                                          @Param("lastId") UUID lastId,
                                          Pageable pageable);
}
