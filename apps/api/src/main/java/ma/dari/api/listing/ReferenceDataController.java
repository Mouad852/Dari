package ma.dari.api.listing;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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

    public ReferenceDataController(ListingRepository listings, AmenityRepository amenities) {
        this.listings = listings;
        this.amenities = amenities;
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

    public record CitySummary(String city, long count) {
    }
}
