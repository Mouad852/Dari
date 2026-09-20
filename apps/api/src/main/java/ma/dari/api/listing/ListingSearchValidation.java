package ma.dari.api.listing;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;

import java.util.Locale;
import java.util.Set;

/** Shared validation for the three public listing-search endpoints. */
public final class ListingSearchValidation {

    private static final Set<String> AMENITIES = Set.of(
            "wifi", "parking", "balcony", "kitchen", "laundry", "air_conditioning",
            "elevator", "near_transport", "furnished", "smoke_free");

    private ListingSearchValidation() {
    }

    public static boolean validate(String city, String neighborhood, Double lat, Double lng, Integer radiusM,
                                   String sort, String[] propertyType, String[] roomType,
                                   String[] furnishing, String[] amenities, Integer priceMin, Integer priceMax) {
        boolean anyLocation = lat != null || lng != null || radiusM != null;
        boolean completeLocation = lat != null && lng != null && radiusM != null;
        if (anyLocation && !completeLocation) {
            throw invalid("Latitude, longitude et rayon doivent être fournis ensemble");
        }
        if (lat != null && (!Double.isFinite(lat) || lat < -90 || lat > 90)) {
            throw invalid("Latitude invalide");
        }
        if (lng != null && (!Double.isFinite(lng) || lng < -180 || lng > 180)) {
            throw invalid("Longitude invalide");
        }
        if (radiusM != null && (radiusM <= 0 || radiusM > 50_000)) {
            throw invalid("Le rayon doit être compris entre 1 et 50000 mètres");
        }
        if ((city != null || neighborhood != null) && anyLocation) {
            throw invalid("La ville, le quartier et le rayon ne peuvent pas être combinés");
        }
        if (priceMin != null && priceMin < 0 || priceMax != null && priceMax < 0
                || priceMin != null && priceMax != null && priceMin > priceMax) {
            throw invalid("Fourchette de prix invalide");
        }
        validateEnum(propertyType, PropertyType.class, "propertyType");
        validateEnum(roomType, RoomType.class, "roomType");
        validateEnum(furnishing, RoomFurnishing.class, "furnishing");
        validateAmenities(amenities);
        if (sort != null && !sort.isBlank() && !Set.of(
                "recommended", "recent", "newest", "priceasc", "priceascending",
                "pricedesc", "pricedescending", "closest", "distance", "updated").contains(
                sort.trim().toLowerCase(Locale.ROOT).replace("_", ""))) {
            throw invalid("Tri invalide");
        }
        return completeLocation;
    }

    private static void validateAmenities(String[] rawValues) {
        for (String raw : values(rawValues)) {
            if (!AMENITIES.contains(raw)) throw invalid("Amenity invalide");
        }
    }

    private static <T extends Enum<T>> void validateEnum(String[] rawValues, Class<T> type, String field) {
        for (String raw : values(rawValues)) {
            try {
                Enum.valueOf(type, raw.toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw invalid("Valeur invalide pour " + field);
            }
        }
    }

    private static Set<String> values(String[] rawValues) {
        if (rawValues == null) return Set.of();
        java.util.LinkedHashSet<String> result = new java.util.LinkedHashSet<>();
        for (String raw : rawValues) {
            if (raw == null) throw invalid("Filtre invalide");
            for (String value : raw.split(",")) {
                String normalized = value.trim();
                if (!normalized.isEmpty()) result.add(normalized);
            }
        }
        return result;
    }

    private static ApiException invalid(String message) {
        return new ApiException(400, ErrorCode.VALIDATION_FAILED, message);
    }
}
