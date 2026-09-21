package ma.dari.api.listing;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The fuzzer's own guarantees, which nothing covered before: every published
 * coordinate depends on these holding, and the API tests that assert privacy
 * now lean on them rather than guessing at digit prefixes.
 */
class LocationFuzzerTest {

    private static final double LAT = 33.5652;
    private static final double LNG = -7.5923;
    private static final double RADIUS_METRES = 200.0;
    private static final String FIRST_TEST_SECRET = "test-only-fuzz-secret-with-at-least-thirty-two-characters";
    private static final String SECOND_TEST_SECRET = "another-test-only-fuzz-secret-with-at-least-thirty-two-chars";

    @Test
    @DisplayName("the same listing always fuzzes to the same point")
    void fuzzIsDeterministicPerListing() {
        UUID id = UUID.randomUUID();
        LocationFuzzer fuzzer = new LocationFuzzer(FIRST_TEST_SECRET);

        assertThat(fuzzer.fuzz(id, LAT, LNG, RADIUS_METRES))
                .containsExactly(fuzzer.fuzz(id, LAT, LNG, RADIUS_METRES));
    }

    @Test
    @DisplayName("a different secret produces a different offset for the same listing")
    void fuzzDiffersBetweenSecrets() {
        UUID id = UUID.fromString("2f66d2cf-1f9c-4fb5-a23a-940e7c61ef13");
        double[] first = new LocationFuzzer(FIRST_TEST_SECRET).fuzz(id, LAT, LNG, RADIUS_METRES);
        double[] second = new LocationFuzzer(SECOND_TEST_SECRET).fuzz(id, LAT, LNG, RADIUS_METRES);

        assertThat(first[0]).isNotEqualTo(second[0]);
        assertThat(first[1]).isNotEqualTo(second[1]);
    }

    @Test
    @DisplayName("every fuzzed point moves, and none escapes the 200m radius")
    void fuzzMovesThePointButStaysInsideTheRadius() {
        LocationFuzzer fuzzer = new LocationFuzzer(FIRST_TEST_SECRET);
        for (int i = 0; i < 1_000; i++) {
            double[] fuzzed = fuzzer.fuzz(new UUID(0L, i), LAT, LNG, RADIUS_METRES);

            assertThat(metresFromOrigin(fuzzed))
                    .isGreaterThan(0.0)
                    .isLessThanOrEqualTo(RADIUS_METRES);
        }
    }

    @Test
    @DisplayName("fixed listing ids are distributed roughly uniformly over the disc")
    void fuzzIsRoughlyUniformOverTheDisc() {
        LocationFuzzer fuzzer = new LocationFuzzer(FIRST_TEST_SECRET);
        int samples = 10_000;
        int sectors = 8;
        int[] sectorCounts = new int[sectors];
        double totalRadius = 0.0;
        double eastMetres = 0.0;
        double northMetres = 0.0;

        for (int i = 0; i < samples; i++) {
            double[] fuzzed = fuzzer.fuzz(new UUID(0L, i), LAT, LNG, RADIUS_METRES);
            double north = (fuzzed[0] - LAT) * 111_320.0;
            double east = (fuzzed[1] - LNG) * 111_320.0 * Math.cos(Math.toRadians(LAT));
            double radius = Math.hypot(north, east);
            double angle = Math.atan2(east, north);
            if (angle < 0) angle += 2.0 * Math.PI;

            sectorCounts[(int) (angle / (2.0 * Math.PI) * sectors)]++;
            totalRadius += radius;
            eastMetres += east;
            northMetres += north;
        }

        // A uniform disc has mean radius 2R/3 and no directional bias. The
        // generous tolerances detect regressions such as dropping sqrt while
        // avoiding a brittle assertion about one fixed digest sample.
        assertThat(totalRadius / samples / RADIUS_METRES).isBetween(0.63, 0.70);
        assertThat(Math.abs(eastMetres / samples / RADIUS_METRES)).isLessThan(0.03);
        assertThat(Math.abs(northMetres / samples / RADIUS_METRES)).isLessThan(0.03);
        for (int sectorCount : sectorCounts) {
            assertThat(sectorCount).isBetween(1_050, 1_450);
        }
    }

    /**
     * The fuzzer's own equirectangular model, inverted — deliberately not a
     * haversine, so this measures the offset the fuzzer intended rather than
     * re-deriving the distance under a different projection.
     */
    private static double metresFromOrigin(double[] fuzzed) {
        double dLat = (fuzzed[0] - LAT) * 111_320.0;
        double dLng = (fuzzed[1] - LNG) * 111_320.0 * Math.cos(Math.toRadians(LAT));
        return Math.hypot(dLat, dLng);
    }
}
