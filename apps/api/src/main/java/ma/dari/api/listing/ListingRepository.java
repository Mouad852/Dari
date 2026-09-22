package ma.dari.api.listing;

import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ListingRepository extends JpaRepository<Listing, UUID> {

    // The expiry job's three queries. Status values are bound as parameters:
    // a JPQL enum literal is rendered as 'EXPIRED'::ListingStatus, which
    // PostgreSQL rejects because the column's type is listing_status.

    /**
     * Gives a window to published listings that have none: rows approved by
     * a release older than V28 while both ran during a deploy or after a
     * rollback. Only ever fills a NULL; never moves an existing date.
     */
    @Modifying
    @Query("""
            update Listing l set l.expiresAt = :expiresAt
            where l.status = :published and l.deletedAt is null and l.expiresAt is null
            """)
    int startMissingExpiryWindows(@Param("published") ListingStatus published,
                                  @Param("expiresAt") Instant expiresAt);

    /** Published, not yet warned, and ending within the warning window. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select l from Listing l
            where l.status = :published
              and l.deletedAt is null
              and l.expiryWarnedAt is null
              and l.expiresAt > :now
              and l.expiresAt <= :warnBefore
            """)
    List<Listing> findToWarnOfExpiry(@Param("published") ListingStatus published,
                                     @Param("now") Instant now,
                                     @Param("warnBefore") Instant warnBefore);

    /**
     * Published and past its end. Locked so an owner's concurrent transition
     * (an edit sending it to review, say) is either seen or waits, and never
     * overwritten by this job's stale copy.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select l from Listing l
            where l.status = :published
              and l.deletedAt is null
              and l.expiresAt <= :now
            """)
    List<Listing> findDueForExpiry(@Param("published") ListingStatus published, @Param("now") Instant now);

    List<Listing> findByStatusAndAvailabilityStateAndDeletedAtIsNull(
            ListingStatus status,
            AvailabilityState availabilityState);

    List<Listing> findByStatusAndDeletedAtIsNull(ListingStatus status);

    /** Backs the moderation-queue-depth gauge; counting avoids loading the queue into memory on every scrape. */
    long countByStatusAndDeletedAtIsNull(ListingStatus status);

    /** Backs the public profile's "Annonces actives" count — same search-visibility invariant as the front end. */
    long countByOwnerIdAndStatusAndAvailabilityStateAndDeletedAtIsNull(
            UUID ownerId, ListingStatus status, AvailabilityState availabilityState);

    boolean existsByIdAndDeletedAtIsNull(UUID id);

    List<Listing> findByOwnerId(UUID ownerId);

    Optional<Listing> findByIdAndOwnerIdAndDeletedAtIsNull(UUID id, UUID ownerId);

    Optional<Listing> findFirstByOwnerIdAndStatusAndDeletedAtIsNullOrderByUpdatedAtDesc(
            UUID ownerId, ListingStatus status);

    Optional<Listing> findByIdAndDeletedAtIsNull(UUID id);

    Optional<Listing> findByIdAndStatusAndAvailabilityStateAndDeletedAtIsNull(
            UUID id, ListingStatus status, AvailabilityState availabilityState);

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
