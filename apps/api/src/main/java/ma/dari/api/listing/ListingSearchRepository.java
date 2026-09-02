package ma.dari.api.listing;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * PostGIS-optimized queries for listing search.
 * All queries use native SQL to access spatial indexes and cursor pagination at the database level.
 */
public interface ListingSearchRepository extends JpaRepository<Listing, UUID> {


    /**
     * The sorted, keyset-paginated public search for non-radius queries.
     *
     * <p>One query rather than a method per sort. The filter block is already
     * repeated across this interface, and four more copies of it would mean any
     * future filter fix has to be applied in eleven places or silently diverge
     * between "sorted by price" and "sorted by date" — a difference nobody would
     * think to test for.
     *
     * <p>Both halves of the sort have to vary together: the ORDER BY, and the
     * keyset predicate that resumes it. A cursor built for one ordering is
     * meaningless in another, which is why the caller passes the last row's
     * price, created_at and updated_at and only the branch matching {@code sort}
     * reads its own.
     *
     * <p>Every nullable parameter is explicitly cast. Postgres cannot infer a
     * type for a bare NULL parameter and fails the whole statement with
     * "could not determine data type" — the same trap that took this search down
     * once already.
     */
    @Query(value = """
            SELECT l.* FROM listings l
            WHERE l.status = 'PUBLISHED'
              AND l.availability_state = 'AVAILABLE'
              AND l.deleted_at IS NULL
              AND (:city IS NULL OR l.city = :city)
              AND (:neighborhood IS NULL OR l.neighborhood = :neighborhood)
              AND (:minPrice IS NULL OR l.price_rent >= :minPrice)
              AND (:maxPrice IS NULL OR l.price_rent <= :maxPrice)
              AND (CAST(:propertyTypes AS property_type[]) IS NULL OR l.property_type = ANY(CAST(:propertyTypes AS property_type[])))
              AND (CAST(:roomTypes AS room_type[]) IS NULL OR l.room_type = ANY(CAST(:roomTypes AS room_type[])))
              AND (CAST(:furnishings AS room_furnishing[]) IS NULL OR l.room_furnishing = ANY(CAST(:furnishings AS room_furnishing[])))
              AND (CAST(:availableBy AS date) IS NULL OR l.available_from <= :availableBy)
              AND (CAST(:amenityCodes AS text[]) IS NULL OR (
                  SELECT COUNT(DISTINCT la.amenity_code) FROM listing_amenities la
                  WHERE la.listing_id = l.id
                    AND la.amenity_code = ANY(CAST(:amenityCodes AS text[]))
              ) = :amenityCount)
              AND (
                  CAST(:lastId AS uuid) IS NULL
                  OR (CAST(:sort AS text) = 'priceasc'
                      AND (l.price_rent, l.id) > (CAST(:lastPrice AS numeric), CAST(:lastId AS uuid)))
                  OR (CAST(:sort AS text) = 'pricedesc'
                      AND (l.price_rent, l.id) < (CAST(:lastPrice AS numeric), CAST(:lastId AS uuid)))
                  OR (CAST(:sort AS text) = 'updated'
                      AND (l.updated_at, l.id) < (CAST(:lastUpdatedAt AS timestamptz), CAST(:lastId AS uuid)))
                  OR (CAST(:sort AS text) NOT IN ('priceasc', 'pricedesc', 'updated')
                      AND (l.created_at, l.id) < (CAST(:lastCreatedAt AS timestamptz), CAST(:lastId AS uuid)))
              )
            ORDER BY
              CASE WHEN CAST(:sort AS text) = 'priceasc' THEN l.price_rent END ASC,
              CASE WHEN CAST(:sort AS text) = 'pricedesc' THEN l.price_rent END DESC,
              CASE WHEN CAST(:sort AS text) = 'updated' THEN l.updated_at END DESC,
              CASE WHEN CAST(:sort AS text) NOT IN ('priceasc', 'pricedesc', 'updated') THEN l.created_at END DESC,
              CASE WHEN CAST(:sort AS text) = 'priceasc' THEN l.id END ASC,
              l.id DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Listing> searchByLocationSorted(
            @Param("city") String city,
            @Param("neighborhood") String neighborhood,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("propertyTypes") String[] propertyTypes,
            @Param("roomTypes") String[] roomTypes,
            @Param("furnishings") String[] furnishings,
            @Param("availableBy") LocalDate availableBy,
            @Param("amenityCodes") String[] amenityCodes,
            @Param("amenityCount") int amenityCount,
            @Param("sort") String sort,
            @Param("lastPrice") BigDecimal lastPrice,
            @Param("lastCreatedAt") java.time.OffsetDateTime lastCreatedAt,
            @Param("lastUpdatedAt") java.time.OffsetDateTime lastUpdatedAt,
            @Param("lastId") UUID lastId,
            @Param("limit") int limit
    );

    /**
     * Search by city and neighborhood with cursor pagination, sorted by creation date descending.
     * Includes all enum-based filters (propertyType, roomType, furnishing) and date availability.
     * Amenities use a GROUP BY HAVING subquery to enforce AND semantics.
     */
    @Query(value = """
            SELECT l.* FROM listings l
            WHERE l.status = 'PUBLISHED'
              AND l.availability_state = 'AVAILABLE'
              AND l.deleted_at IS NULL
              AND (:city IS NULL OR l.city = :city)
              AND (:neighborhood IS NULL OR l.neighborhood = :neighborhood)
              AND (:minPrice IS NULL OR l.price_rent >= :minPrice)
              AND (:maxPrice IS NULL OR l.price_rent <= :maxPrice)
              AND (CAST(:propertyTypes AS property_type[]) IS NULL OR l.property_type = ANY(CAST(:propertyTypes AS property_type[])))
              AND (CAST(:roomTypes AS room_type[]) IS NULL OR l.room_type = ANY(CAST(:roomTypes AS room_type[])))
              AND (CAST(:furnishings AS room_furnishing[]) IS NULL OR l.room_furnishing = ANY(CAST(:furnishings AS room_furnishing[])))
              AND (CAST(:availableBy AS date) IS NULL OR l.available_from <= :availableBy)
              AND (CAST(:amenityCodes AS text[]) IS NULL OR (
                  SELECT COUNT(DISTINCT la.amenity_code) FROM listing_amenities la
                  WHERE la.listing_id = l.id
                    AND la.amenity_code = ANY(CAST(:amenityCodes AS text[]))
              ) = :amenityCount)
            ORDER BY l.created_at DESC, l.id DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Listing> searchByLocationPaginated(
            @Param("city") String city,
            @Param("neighborhood") String neighborhood,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("propertyTypes") String[] propertyTypes,
            @Param("roomTypes") String[] roomTypes,
            @Param("furnishings") String[] furnishings,
            @Param("availableBy") LocalDate availableBy,
            @Param("amenityCodes") String[] amenityCodes,
            @Param("amenityCount") int amenityCount,
            @Param("limit") int limit
    );

    /**
     * Radius search around a point, ordered by distance ascending, then ID descending.
     * Includes all enum-based filters and amenities AND logic.
     * Uses the idx_listings_location GIST index for efficient spatial lookups.
     */
    @Query(value = """
            SELECT l.* FROM listings l
            WHERE l.status = 'PUBLISHED'
              AND l.availability_state = 'AVAILABLE'
              AND l.deleted_at IS NULL
              AND (:city IS NULL OR l.city = :city)
              AND (:neighborhood IS NULL OR l.neighborhood = :neighborhood)
              AND (:minPrice IS NULL OR l.price_rent >= :minPrice)
              AND (:maxPrice IS NULL OR l.price_rent <= :maxPrice)
              AND (CAST(:propertyTypes AS property_type[]) IS NULL OR l.property_type = ANY(CAST(:propertyTypes AS property_type[])))
              AND (CAST(:roomTypes AS room_type[]) IS NULL OR l.room_type = ANY(CAST(:roomTypes AS room_type[])))
              AND (CAST(:furnishings AS room_furnishing[]) IS NULL OR l.room_furnishing = ANY(CAST(:furnishings AS room_furnishing[])))
              AND (CAST(:availableBy AS date) IS NULL OR l.available_from <= :availableBy)
              AND (CAST(:amenityCodes AS text[]) IS NULL OR (
                  SELECT COUNT(DISTINCT la.amenity_code) FROM listing_amenities la
                  WHERE la.listing_id = l.id
                    AND la.amenity_code = ANY(CAST(:amenityCodes AS text[]))
              ) = :amenityCount)
              AND ST_DWithin(
                  l.location,
                  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                  :radiusM
              )
            ORDER BY ST_Distance(
                  l.location,
                  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
              ) ASC,
              l.id DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Listing> searchByRadiusPaginated(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusM") int radiusM,
            @Param("city") String city,
            @Param("neighborhood") String neighborhood,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("propertyTypes") String[] propertyTypes,
            @Param("roomTypes") String[] roomTypes,
            @Param("furnishings") String[] furnishings,
            @Param("availableBy") LocalDate availableBy,
            @Param("amenityCodes") String[] amenityCodes,
            @Param("amenityCount") int amenityCount,
            @Param("limit") int limit
    );

    /**
     * Keyset pagination cursor for radius queries: find all results where distance > lastDistance,
     * or if distance equals lastDistance, find results where ID < lastId (reverse order for stable sort).
     * Includes all enum-based filters and amenities AND logic.
     */
    @Query(value = """
            SELECT l.* FROM listings l
            WHERE l.status = 'PUBLISHED'
              AND l.availability_state = 'AVAILABLE'
              AND l.deleted_at IS NULL
              AND (:city IS NULL OR l.city = :city)
              AND (:neighborhood IS NULL OR l.neighborhood = :neighborhood)
              AND (:minPrice IS NULL OR l.price_rent >= :minPrice)
              AND (:maxPrice IS NULL OR l.price_rent <= :maxPrice)
              AND (CAST(:propertyTypes AS property_type[]) IS NULL OR l.property_type = ANY(CAST(:propertyTypes AS property_type[])))
              AND (CAST(:roomTypes AS room_type[]) IS NULL OR l.room_type = ANY(CAST(:roomTypes AS room_type[])))
              AND (CAST(:furnishings AS room_furnishing[]) IS NULL OR l.room_furnishing = ANY(CAST(:furnishings AS room_furnishing[])))
              AND (CAST(:availableBy AS date) IS NULL OR l.available_from <= :availableBy)
              AND (CAST(:amenityCodes AS text[]) IS NULL OR (
                  SELECT COUNT(DISTINCT la.amenity_code) FROM listing_amenities la
                  WHERE la.listing_id = l.id
                    AND la.amenity_code = ANY(CAST(:amenityCodes AS text[]))
              ) = :amenityCount)
              AND ST_DWithin(
                  l.location,
                  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                  :radiusM
              )
              AND (
                  ST_Distance(
                      l.location,
                      ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                  ) > :lastDistance
                  OR (
                      ST_Distance(
                          l.location,
                          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                      ) = :lastDistance
                      AND l.id < :lastId
                  )
              )
            ORDER BY ST_Distance(
                  l.location,
                  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
              ) ASC,
              l.id DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Listing> searchByRadiusWithCursor(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusM") int radiusM,
            @Param("city") String city,
            @Param("neighborhood") String neighborhood,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("propertyTypes") String[] propertyTypes,
            @Param("roomTypes") String[] roomTypes,
            @Param("furnishings") String[] furnishings,
            @Param("availableBy") LocalDate availableBy,
            @Param("amenityCodes") String[] amenityCodes,
            @Param("amenityCount") int amenityCount,
            @Param("lastDistance") double lastDistance,
            @Param("lastId") UUID lastId,
            @Param("limit") int limit
    );

    /**
     * Keyset pagination cursor for location-based queries: find results where created_at < lastCreatedAt,
     * or if created_at equals lastCreatedAt, find results where ID < lastId.
     * Includes all enum-based filters and amenities AND logic.
     */
    @Query(value = """
            SELECT l.* FROM listings l
            WHERE l.status = 'PUBLISHED'
              AND l.availability_state = 'AVAILABLE'
              AND l.deleted_at IS NULL
              AND (:city IS NULL OR l.city = :city)
              AND (:neighborhood IS NULL OR l.neighborhood = :neighborhood)
              AND (:minPrice IS NULL OR l.price_rent >= :minPrice)
              AND (:maxPrice IS NULL OR l.price_rent <= :maxPrice)
              AND (CAST(:propertyTypes AS property_type[]) IS NULL OR l.property_type = ANY(CAST(:propertyTypes AS property_type[])))
              AND (CAST(:roomTypes AS room_type[]) IS NULL OR l.room_type = ANY(CAST(:roomTypes AS room_type[])))
              AND (CAST(:furnishings AS room_furnishing[]) IS NULL OR l.room_furnishing = ANY(CAST(:furnishings AS room_furnishing[])))
              AND (CAST(:availableBy AS date) IS NULL OR l.available_from <= :availableBy)
              AND (CAST(:amenityCodes AS text[]) IS NULL OR (
                  SELECT COUNT(DISTINCT la.amenity_code) FROM listing_amenities la
                  WHERE la.listing_id = l.id
                    AND la.amenity_code = ANY(CAST(:amenityCodes AS text[]))
              ) = :amenityCount)
              AND (
                  l.created_at < :lastCreatedAt
                  OR (l.created_at = :lastCreatedAt AND l.id < :lastId)
              )
            ORDER BY l.created_at DESC, l.id DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Listing> searchByLocationWithCursor(
            @Param("city") String city,
            @Param("neighborhood") String neighborhood,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("propertyTypes") String[] propertyTypes,
            @Param("roomTypes") String[] roomTypes,
            @Param("furnishings") String[] furnishings,
            @Param("availableBy") LocalDate availableBy,
            @Param("amenityCodes") String[] amenityCodes,
            @Param("amenityCount") int amenityCount,
            @Param("lastCreatedAt") java.time.OffsetDateTime lastCreatedAt,
            @Param("lastId") UUID lastId,
            @Param("limit") int limit
    );

    /**
     * Get all map pins for public search (no pagination).
     * Includes all filters for consistency with the main search.
     */
    @Query(value = """
            SELECT l.* FROM listings l
            WHERE l.status = 'PUBLISHED'
              AND l.availability_state = 'AVAILABLE'
              AND l.deleted_at IS NULL
              AND (:city IS NULL OR l.city = :city)
              AND (:neighborhood IS NULL OR l.neighborhood = :neighborhood)
              AND (:minPrice IS NULL OR l.price_rent >= :minPrice)
              AND (:maxPrice IS NULL OR l.price_rent <= :maxPrice)
              AND (CAST(:propertyTypes AS property_type[]) IS NULL OR l.property_type = ANY(CAST(:propertyTypes AS property_type[])))
              AND (CAST(:roomTypes AS room_type[]) IS NULL OR l.room_type = ANY(CAST(:roomTypes AS room_type[])))
              AND (CAST(:furnishings AS room_furnishing[]) IS NULL OR l.room_furnishing = ANY(CAST(:furnishings AS room_furnishing[])))
              AND (:availableBy IS NULL OR l.available_from IS NULL OR l.available_from <= :availableBy)
              AND (CAST(:amenityCodes AS text[]) IS NULL OR (
                  SELECT COUNT(DISTINCT la.amenity_code) FROM listing_amenities la
                  WHERE la.listing_id = l.id
                    AND la.amenity_code = ANY(CAST(:amenityCodes AS text[]))
              ) = :amenityCount)
              AND (
                  :radiusM IS NULL OR ST_DWithin(
                      l.location,
                      ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                      :radiusM
                  )
              )
            """, nativeQuery = true)
    List<Listing> mapPinsByLocationAndRadius(
            @Param("city") String city,
            @Param("neighborhood") String neighborhood,
            @Param("minPrice") BigDecimal minPrice,
            @Param("maxPrice") BigDecimal maxPrice,
            @Param("propertyTypes") String[] propertyTypes,
            @Param("roomTypes") String[] roomTypes,
            @Param("furnishings") String[] furnishings,
            @Param("availableBy") LocalDate availableBy,
            @Param("amenityCodes") String[] amenityCodes,
            @Param("amenityCount") int amenityCount,
            @Param("lat") Double lat,
            @Param("lng") Double lng,
            @Param("radiusM") Integer radiusM
    );

    /**
     * Featured listings: most recent public listings, no pagination, up to limit.
     */
    @Query(value = """
            SELECT * FROM listings
            WHERE status = 'PUBLISHED'
              AND availability_state = 'AVAILABLE'
              AND deleted_at IS NULL
            ORDER BY created_at DESC, id DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Listing> featuredListings(@Param("limit") int limit);
}
