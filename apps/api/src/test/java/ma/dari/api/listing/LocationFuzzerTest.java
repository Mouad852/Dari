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

    @Test
    @DisplayName("the same listing always fuzzes to the same point")
    void fuzzIsDeterministicPerListing() {
        UUID id = UUID.randomUUID();

        assertThat(LocationFuzzer.fuzz(id, LAT, LNG))
                .containsExactly(LocationFuzzer.fuzz(id, LAT, LNG));
    }

    @Test
    @DisplayName("different listings at the same address land on different points")
    void fuzzDiffersBetweenListings() {
        double[] first = LocationFuzzer.fuzz(UUID.randomUUID(), LAT, LNG);
        double[] second = LocationFuzzer.fuzz(UUID.randomUUID(), LAT, LNG);

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    @DisplayName("every fuzzed point moves, and none escapes the 200m radius")
    void fuzzMovesThePointButStaysInsideTheRadius() {
        for (int i = 0; i < 1_000; i++) {
            double[] fuzzed = LocationFuzzer.fuzz(UUID.randomUUID(), LAT, LNG);

            assertThat(metresFromOrigin(fuzzed))
                    .isGreaterThan(0.0)
                    .isLessThanOrEqualTo(200.0);
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
