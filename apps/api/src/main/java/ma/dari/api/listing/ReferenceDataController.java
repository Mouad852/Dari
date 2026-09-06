package ma.dari.api.listing;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Public reference data for homepage tiles and filter UIs.
 */
@RestController
@RequestMapping("/api/v1")
public class ReferenceDataController {

    private final ListingRepository listings;
    private final AmenityRepository amenities;
    private final NeighborhoodRepository neighborhoods;

    public ReferenceDataController(ListingRepository listings, AmenityRepository amenities,
                                   NeighborhoodRepository neighborhoods) {
        this.listings = listings;
        this.amenities = amenities;
        this.neighborhoods = neighborhoods;
    }

    /** Cities with live published counts, for the homepage tiles. */
    @GetMapping("/cities")
    public List<CitySummary> cities() {
        return listings.findByStatusAndAvailabilityStateAndDeletedAtIsNull(ListingStatus.PUBLISHED, AvailabilityState.AVAILABLE)
                .stream()
                .collect(Collectors.groupingBy(Listing::getCity, Collectors.counting()))
                .entrySet()
                .stream()
                .map(entry -> new CitySummary(entry.getKey(), entry.getValue()))
                .sorted(Comparator.comparing(CitySummary::count, Comparator.reverseOrder())
                        .thenComparing(CitySummary::city))
                .toList();
    }

    /** The reference codes a listing can be tagged with, in display order. */
    @GetMapping("/amenities")
    public List<String> amenities() {
        return this.amenities.findAllByOrderBySortOrderAsc().stream().map(Amenity::getCode).toList();
    }

    /**
     * Real neighborhood names for one city, in display order.
     *
     * <p>The neighborhood name itself is still never enforced — a listing's
     * {@code neighborhood} field stays free text, so a name missing from this
     * list cannot block a real owner from publishing. This is a lookup for
     * autocomplete/filter UIs, not a whitelist. The city is a different story:
     * {@code ListingService} now rejects a city with no row in this table at
     * all (2026-09-06).
     */
    @GetMapping("/neighborhoods")
    public List<String> neighborhoods(@RequestParam(required = false) String city) {
        if (city == null || city.isBlank()) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Ville requise");
        }
        return neighborhoods.findByCityOrderBySortOrderAsc(city).stream()
                .map(Neighborhood::getName)
                .toList();
    }

    public record CitySummary(String city, long count) {
    }
}
