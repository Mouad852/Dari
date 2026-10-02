package ma.dari.api.listing;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FavoriteRepository extends JpaRepository<Favorite, Favorite.FavoriteId> {

    Optional<Favorite> findByUserIdAndListingId(UUID userId, UUID listingId);

    /**
     * Saves the favorite unless it already exists; the primary key decides
     * (audit P2-3). Catching the duplicate-key error instead left the
     * PostgreSQL transaction aborted, so a double tap answered 500.
     */
    @Modifying
    @Query(value = """
            insert into favorites (user_id, listing_id, created_at)
            values (:userId, :listingId, :now)
            on conflict (user_id, listing_id) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(@Param("userId") UUID userId, @Param("listingId") UUID listingId,
                       @Param("now") Instant now);

    @Query("""
            select f.listing.id from Favorite f
            where f.user.id = :userId and f.listing.deletedAt is null
            """)
    List<UUID> findListingIdsByUserId(@Param("userId") UUID userId);

    /**
     * Drops soft-deleted listings entirely; keeps everything else — including
     * SUSPENDED, EXPIRED and ROOM_FOUND — so a favorited listing never
     * silently disappears, only changes what it shows.
     */
    @Query("""
            select f from Favorite f join f.listing l
            where f.user.id = :userId and l.deletedAt is null
            order by f.createdAt desc, l.id desc
            """)
    List<Favorite> findVisibleByUser(@Param("userId") UUID userId, Pageable pageable);

    @Query("""
            select f from Favorite f join f.listing l
            where f.user.id = :userId and l.deletedAt is null
              and (f.createdAt < :lastCreatedAt or (f.createdAt = :lastCreatedAt and l.id < :lastListingId))
            order by f.createdAt desc, l.id desc
            """)
    List<Favorite> findVisibleByUserAfter(@Param("userId") UUID userId,
                                          @Param("lastCreatedAt") Instant lastCreatedAt,
                                          @Param("lastListingId") UUID lastListingId,
                                          Pageable pageable);
}
