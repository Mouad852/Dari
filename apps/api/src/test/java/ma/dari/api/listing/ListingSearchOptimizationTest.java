package ma.dari.api.listing;

import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phase 02: Verify PostGIS query optimization and cursor pagination.
 * Tests that spatial queries use proper indexing and cursor pagination works correctly.
 */
class ListingSearchOptimizationTest extends AbstractIntegrationTest {

    @Autowired
    private ListingRepository listings;

    @Autowired
    private UserRepository users;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ListingSearchRepository search;

    private User owner;

    @BeforeEach
    void setUp() {
        // The integration container is shared across test classes; isolate the
        // public search dataset without touching drafts or other lifecycle states.
        jdbc.update("""
                DELETE FROM listings
                WHERE status = 'PUBLISHED'
                  AND availability_state = 'AVAILABLE'
                  AND deleted_at IS NULL
                """);

        String uid = "uid-opt-" + UUID.randomUUID().toString().substring(0, 8);
        owner = users.save(new User(uid, uid + "@example.ma", true, "Opt Owner"));
    }

    @Test
    @DisplayName("radius search returns listings within distance")
    void radiusSearchReturnsWithinDistance() {
        // Seed listings around Rabat
        seedListingsAroundRabat(20);

        // Execute radius search: 5km around city center
        double rabatLat = 34.0209;  // Rabat center
        double rabatLng = -6.8416;
        int radiusM = 5000;

        List<Listing> results = search.searchByRadiusPaginated(
                rabatLat, rabatLng, radiusM,
                null, null,
                null, null, null, null, null, null, null, 0,
                21
        );

        // Verify results are within radius
        assertThat(results).isNotEmpty();
        assertThat(results.size()).isLessThanOrEqualTo(20);
        
        // Verify all results are closer than the radius
        for (Listing l : results) {
            double distance = haversineMiles(rabatLat, rabatLng, l.getLatitude(), l.getLongitude()) * 1609.344;
            assertThat(distance).isLessThanOrEqualTo(radiusM + 100);  // Allow small tolerance
        }
    }

    @Test
    @DisplayName("location search returns listings by city")
    void locationSearchReturnsByCity() {
        // Seed listings in Rabat
        for (int i = 0; i < 15; i++) {
            Listing l = new Listing(
                    owner,
                    "Listing Rabat " + i,
                    "Rabat",
                    "Agdal",
                    34.0209 + (i * 0.001),
                    -6.8416 + (i * 0.001),
                    new BigDecimal("2500.00"),
                    ListingStatus.PUBLISHED,
                    AvailabilityState.AVAILABLE
            );
            listings.saveAndFlush(l);
        }

        // Also seed one in a different city
        Listing casablanca = new Listing(
                owner,
                "Listing Casablanca",
                "Casablanca",
                "Maarif",
                33.5731,
                -7.5898,
                new BigDecimal("2800.00"),
                ListingStatus.PUBLISHED,
                AvailabilityState.AVAILABLE
        );
        listings.saveAndFlush(casablanca);

        // Search Rabat only
        List<Listing> rabatResults = search.searchByLocationPaginated(
                "Rabat", null, null, null, null, null, null, null, null, 0, 100
        );

        assertThat(rabatResults.size()).isEqualTo(15);
        assertThat(rabatResults).allMatch(l -> l.getCity().equals("Rabat"));
    }

    @Test
    @DisplayName("cursor pagination maintains stable order across requests")
    void cursorPaginationIsSortStable() {
        // Seed 50 listings
        for (int i = 0; i < 50; i++) {
            Listing l = new Listing(
                    owner,
                    "Stable Listing " + i,
                    "Rabat",
                    "Agdal",
                    34.0209 + (i * 0.0001),
                    -6.8416 + (i * 0.0001),
                    BigDecimal.valueOf(2500 + i * 100),
                    ListingStatus.PUBLISHED,
                    AvailabilityState.AVAILABLE
            );
            listings.saveAndFlush(l);
        }

        // Get first page
        List<Listing> page1 = search.searchByLocationPaginated(
                "Rabat", null, null, null, null, null, null, null, null, 0, 11
        );
        assertThat(page1).hasSize(11);

        // Get second page using cursor
        var lastListing = page1.get(10);
        List<Listing> page2 = search.searchByLocationWithCursor(
                "Rabat", null, null, null, null, null, null, null, null, 0,
                java.time.OffsetDateTime.ofInstant(lastListing.getCreatedAt(), java.time.ZoneId.systemDefault()), 
                lastListing.getId(),
                11
        );
        
        // Verify no overlap
        var page1Ids = page1.stream().map(Listing::getId).toList();
        var page2Ids = page2.stream().map(Listing::getId).toList();
        
        for (var id : page2Ids) {
            assertThat(page1Ids).doesNotContain(id);
        }
    }

    @Test
    @DisplayName("price filtering works correctly")
    void priceFilteringWorks() {
        // Create listings with different prices
        for (int price = 1000; price <= 5000; price += 500) {
            Listing l = new Listing(
                    owner,
                    "Price " + price,
                    "Rabat",
                    "Agdal",
                    34.0209,
                    -6.8416,
                    BigDecimal.valueOf(price),
                    ListingStatus.PUBLISHED,
                    AvailabilityState.AVAILABLE
            );
            listings.saveAndFlush(l);
        }

        // Filter by price range
        List<Listing> expensive = search.searchByLocationPaginated(
                "Rabat", null,
                BigDecimal.valueOf(3000), null,
                null, null, null,
                null, null, 0,
                100
        );

        assertThat(expensive).allMatch(l -> l.getPriceRent().compareTo(BigDecimal.valueOf(3000)) >= 0);
        assertThat(expensive.size()).isGreaterThan(0);
    }

    @Test
    @DisplayName("distance sort works for radius search")
    void distanceSortWorks() {
        // Seed listings around Rabat
        seedListingsAroundRabat(10);

        double centerLat = 34.0209;
        double centerLng = -6.8416;

        // Get distance-sorted results
        List<Listing> results = search.searchByRadiusPaginated(
                centerLat, centerLng, 10000,  // 10km radius
                null, null, null, null,
                null, null, null,
                null, null, 0,
                100
        );

        // Verified against ST_Distance itself, not a Java reimplementation of it.
        //
        // This used to recompute distance with the haversineMiles helper below,
        // a spherical-Earth approximation. `location` is a `geography` column, so
        // the query's own ORDER BY runs PostGIS's ST_Distance, which is geodesic
        // (WGS84 spheroid) by default -- a different model that can disagree with
        // a sphere formula by a few metres for two listings nearly equidistant
        // from the origin. That was enough, at random, to flip which of two
        // correctly-sorted rows looked closer under the test's own recomputation
        // and fail the assertion -- not a real ordering bug, just two distance
        // models compared with zero tolerance. Asking Postgres for the same
        // ST_Distance the query ordered by removes the discrepancy at the root
        // instead of tolerating it with a fudge factor.
        Map<UUID, Double> distances = distancesFromOrigin(results, centerLat, centerLng);

        double prevDistance = 0;
        for (Listing l : results) {
            double distance = distances.get(l.getId());
            assertThat(distance).isGreaterThanOrEqualTo(prevDistance);
            prevDistance = distance;
        }
    }

    private Map<UUID, Double> distancesFromOrigin(List<Listing> listingsToMeasure, double lat, double lng) {
        List<UUID> ids = listingsToMeasure.stream().map(Listing::getId).toList();
        return jdbc.query(
                "SELECT id, ST_Distance(location, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography) AS dist "
                        + "FROM listings WHERE id = ANY(?)",
                ps -> {
                    ps.setDouble(1, lng);
                    ps.setDouble(2, lat);
                    ps.setArray(3, ps.getConnection().createArrayOf("uuid", ids.toArray()));
                },
                rs -> {
                    Map<UUID, Double> byId = new HashMap<>();
                    while (rs.next()) {
                        byId.put(UUID.fromString(rs.getString("id")), rs.getDouble("dist"));
                    }
                    return byId;
                }
        );
    }

    private void seedListingsAroundRabat(int count) {
        double baseLat = 34.0209;
        double baseLng = -6.8416;

        for (int i = 0; i < count; i++) {
            // Distribute listings within ~10km radius
            double offsetLat = (Math.random() - 0.5) * 0.15;  // ~0-15km north/south
            double offsetLng = (Math.random() - 0.5) * 0.15;  // ~0-15km east/west

            Listing l = new Listing(
                    owner,
                    "Listing Rabat " + i,
                    "Rabat",
                    "Agdal",
                    baseLat + offsetLat,
                    baseLng + offsetLng,
                    new BigDecimal("2500.00"),
                    ListingStatus.PUBLISHED,
                    AvailabilityState.AVAILABLE
            );
            listings.saveAndFlush(l);
        }
    }

    private double haversineMiles(double lat1, double lng1, double lat2, double lng2) {
        double R = 3959; // Earth's radius in miles
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.asin(Math.sqrt(a));
        return R * c;
    }
}
