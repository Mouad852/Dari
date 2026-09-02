package ma.dari.api.listing;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.common.pagination.Cursor;
import ma.dari.api.common.pagination.CursorPage;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRole;
import ma.dari.api.listing.dto.ListingPhotoResponse;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ListingSearchService {

    private static final int PAGE_SIZE = 20;

    private final ListingRepository listings;
    private final ListingSearchRepository search;
    private final ListingAmenityRepository listingAmenities;
    private final ListingPhotoRepository listingPhotos;

    public ListingSearchService(ListingRepository listings, ListingSearchRepository search,
                                ListingAmenityRepository listingAmenities, ListingPhotoRepository listingPhotos) {
        this.listings = listings;
        this.search = search;
        this.listingAmenities = listingAmenities;
        this.listingPhotos = listingPhotos;
    }

    public CursorPage<PublicListingResponse> search(String city,
                                                  String neighborhood,
                                                  String[] propertyType,
                                                  String[] roomType,
                                                  String[] furnishing,
                                                  String[] amenities,
                                                  LocalDate availableFrom,
                                                  Integer priceMin,
                                                  Integer priceMax,
                                                  Double lat,
                                                  Double lng,
                                                  Integer radiusM,
                                                  String sort,
                                                  String cursor) {
        if ((city != null || neighborhood != null) && (lat != null || lng != null || radiusM != null)) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "La ville, le quartier et le rayon ne peuvent pas être combinés");
        }

        if (radiusM != null && radiusM > 50_000) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Rayon trop large");
        }

        String effectiveSort = sort == null ? "recommended" : sort;

        List<Listing> page;
        String nextCursor = null;
        
        // Convert price params to BigDecimal for SQL queries
        BigDecimal minPrice = priceMin == null ? null : BigDecimal.valueOf(priceMin);
        BigDecimal maxPrice = priceMax == null ? null : BigDecimal.valueOf(priceMax);

        // Normalize enum arrays: empty arrays are treated as null (no filter)
        String[] normalizedPropertyTypes = normalizeValues(propertyType);
        String[] normalizedRoomTypes = normalizeValues(roomType);
        String[] normalizedFurnishings = normalizeValues(furnishing);
        String[] normalizedAmenities = normalizeValues(amenities);
        int amenityCount = normalizedAmenities != null ? normalizedAmenities.length : 0;

        if (lat != null && lng != null && radiusM != null) {
            // Radius search uses distance-based pagination
            if (!"closest".equalsIgnoreCase(normalizeSort(effectiveSort)) && 
                !"distance".equalsIgnoreCase(normalizeSort(effectiveSort))) {
                throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Le tri 'closest' ou 'distance' est obligatoire pour la recherche par rayon");
            }

            // Distance sort requires a different cursor format: distance + id
            if (cursor != null && !cursor.isBlank()) {
                ObjectNode payload = Cursor.decode(cursor);
                String lastIdStr = payload.path("lastId").asText(null);
                UUID lastId = lastIdStr != null ? UUID.fromString(lastIdStr) : null;

                if (lastId != null) {
                    // For cursor pagination in distance mode, we need the actual distance of the last item
                    // Query to get it from the last listing
                    var lastItem = listings.findById(lastId);
                    double lastDistance = lastItem.map(l -> 
                        haversineMiles(lat, lng, l.getLatitude(), l.getLongitude()) * 1609.344
                    ).orElse(0.0);

                    page = search.searchByRadiusWithCursor(
                            lat, lng, radiusM,
                            city, neighborhood,
                            minPrice, maxPrice,
                            normalizedPropertyTypes, normalizedRoomTypes, normalizedFurnishings,
                            availableFrom, normalizedAmenities, amenityCount,
                            lastDistance, lastId,
                            PAGE_SIZE + 1
                    );
                } else {
                    page = search.searchByRadiusPaginated(
                            lat, lng, radiusM,
                            city, neighborhood,
                            minPrice, maxPrice,
                            normalizedPropertyTypes, normalizedRoomTypes, normalizedFurnishings,
                            availableFrom, normalizedAmenities, amenityCount,
                            PAGE_SIZE + 1
                    );
                }
            } else {
                page = search.searchByRadiusPaginated(
                        lat, lng, radiusM,
                        city, neighborhood,
                        minPrice, maxPrice,
                        normalizedPropertyTypes, normalizedRoomTypes, normalizedFurnishings,
                        availableFrom, normalizedAmenities, amenityCount,
                        PAGE_SIZE + 1
                );
            }

            // Build next cursor with distance information
            if (page.size() > PAGE_SIZE) {
                Listing lastListing = page.get(PAGE_SIZE - 1);
                ObjectNode cursorPayload = JsonNodeFactory.instance.objectNode();
                cursorPayload.put("lastId", lastListing.getId().toString());
                // Distance will be recalculated on next query by PostGIS
                cursorPayload.put("mode", "distance");
                nextCursor = Cursor.encode(cursorPayload);
                page = page.subList(0, PAGE_SIZE);
            }
        } else {
            // Non-radius search. The sort drives both the ordering and the shape
            // of the keyset cursor, so the two are resolved together.
            String activeSort = normalizeSort(effectiveSort);
            if ("closest".equals(activeSort)) {
                throw new ApiException(400, ErrorCode.VALIDATION_FAILED,
                        "Le tri par distance nécessite une recherche par rayon");
            }

            UUID lastId = null;
            BigDecimal lastPrice = null;
            OffsetDateTime lastCreatedAt = null;
            OffsetDateTime lastUpdatedAt = null;

            if (cursor != null && !cursor.isBlank()) {
                ObjectNode payload = Cursor.decode(cursor);
                String lastIdStr = payload.path("lastId").asText(null);
                if (lastIdStr != null) {
                    lastId = UUID.fromString(lastIdStr);
                    // A cursor is only meaningful for the sort that produced it.
                    // Resuming a price-sorted page with a date cursor would skip
                    // or repeat rows silently, so the sort travels in the cursor
                    // and a mismatch restarts from the first page rather than
                    // returning a quietly wrong one.
                    String cursorSort = payload.path("sort").asText(null);
                    if (cursorSort != null && !cursorSort.equals(activeSort)) {
                        lastId = null;
                    } else {
                        String priceStr = payload.path("lastPrice").asText(null);
                        String createdStr = payload.path("lastCreatedAt").asText(null);
                        String updatedStr = payload.path("lastUpdatedAt").asText(null);
                        lastPrice = priceStr == null ? null : new BigDecimal(priceStr);
                        lastCreatedAt = createdStr == null ? null : OffsetDateTime.parse(createdStr);
                        lastUpdatedAt = updatedStr == null ? null : OffsetDateTime.parse(updatedStr);
                    }
                }
            }

            page = search.searchByLocationSorted(
                    city, neighborhood,
                    minPrice, maxPrice,
                    normalizedPropertyTypes, normalizedRoomTypes, normalizedFurnishings,
                    availableFrom, normalizedAmenities, amenityCount,
                    activeSort, lastPrice, lastCreatedAt, lastUpdatedAt, lastId,
                    PAGE_SIZE + 1
            );

            if (page.size() > PAGE_SIZE) {
                Listing lastListing = page.get(PAGE_SIZE - 1);
                ObjectNode cursorPayload = JsonNodeFactory.instance.objectNode();
                cursorPayload.put("sort", activeSort);
                cursorPayload.put("lastId", lastListing.getId().toString());
                cursorPayload.put("lastPrice", lastListing.getPriceRent().toPlainString());
                cursorPayload.put("lastCreatedAt", lastListing.getCreatedAt().toString());
                cursorPayload.put("lastUpdatedAt", lastListing.getUpdatedAt().toString());
                nextCursor = Cursor.encode(cursorPayload);
                page = page.subList(0, PAGE_SIZE);
            }
        }

        // Map listings to responses with fuzzed coordinates
        List<PublicListingResponse> items = page.stream()
                .map(l -> PublicListingResponse.from(l, LocationFuzzer.fuzz(l.getId(), l.getLatitude(), l.getLongitude())))
                .toList();

        return CursorPage.of(items, nextCursor);
    }

    public java.util.List<MapPinResponse> mapPins(String city,
                                                 String neighborhood,
                                                 String[] propertyType,
                                                 String[] roomType,
                                                 String[] furnishing,
                                                 String[] amenities,
                                                 Integer priceMin,
                                                 Integer priceMax,
                                                 LocalDate availableFrom,
                                                 Double lat,
                                                 Double lng,
                                                 Integer radiusM) {
        if ((city != null || neighborhood != null) && (lat != null || lng != null || radiusM != null)) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "La ville, le quartier et le rayon ne peuvent pas être combinés");
        }
        if (radiusM != null && (lat == null || lng == null)) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Un point de référence est requis pour le rayon");
        }
        if (radiusM != null && radiusM > 50_000) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Rayon trop large");
        }

        // Normalize enums and price params
        String[] normalizedPropertyTypes = normalizeValues(propertyType);
        String[] normalizedRoomTypes = normalizeValues(roomType);
        String[] normalizedFurnishings = normalizeValues(furnishing);
        String[] normalizedAmenities = normalizeValues(amenities);
        int amenityCount = normalizedAmenities != null ? normalizedAmenities.length : 0;
        BigDecimal minPrice = priceMin == null ? null : BigDecimal.valueOf(priceMin);
        BigDecimal maxPrice = priceMax == null ? null : BigDecimal.valueOf(priceMax);

        // Use PostGIS query with all filters applied at the database level
        List<Listing> listings_ = search.mapPinsByLocationAndRadius(
                city, neighborhood,
                minPrice, maxPrice,
                normalizedPropertyTypes, normalizedRoomTypes, normalizedFurnishings,
                availableFrom, normalizedAmenities, amenityCount,
                lat, lng, radiusM
        );

        return listings_.stream()
                .map(l -> MapPinResponse.from(l, LocationFuzzer.fuzz(l.getId(), l.getLatitude(), l.getLongitude())))
                .toList();
    }

    public List<PublicListingResponse> featured(int limit) {
        int normalizedLimit = Math.max(1, Math.min(limit <= 0 ? 6 : limit, 12));

        // Use PostGIS query instead of loading all listings into memory
        List<Listing> featured = search.featuredListings(normalizedLimit);

        return featured.stream()
                .map(l -> PublicListingResponse.from(l, LocationFuzzer.fuzz(l.getId(), l.getLatitude(), l.getLongitude())))
                .toList();
    }

    public PublicListingResponse getPublicOrOwnerListing(UUID listingId, User viewer) {
        Listing listing = listings.findById(listingId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

        if (listing.getDeletedAt() != null) {
            throw new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable");
        }

        if (viewer != null && listing.getOwner().getId().equals(viewer.getId())) {
            return PublicListingResponse.from(listing, LocationFuzzer.fuzz(listing.getId(), listing.getLatitude(), listing.getLongitude()));
        }

        // Moderators review PENDING_REVIEW/SUSPENDED listings that belong to
        // someone else; without this, the admin console's own "view listing"
        // link 404s on exactly the listings it exists to review.
        if (viewer != null && viewer.getRole() == UserRole.ADMIN) {
            return PublicListingResponse.from(listing, LocationFuzzer.fuzz(listing.getId(), listing.getLatitude(), listing.getLongitude()));
        }

        if (listing.getStatus() == ListingStatus.PUBLISHED
                && listing.getAvailabilityState() == AvailabilityState.AVAILABLE) {
            return PublicListingResponse.from(listing, LocationFuzzer.fuzz(listing.getId(), listing.getLatitude(), listing.getLongitude()));
        }

        throw new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable");
    }

    public PublicListingDetailResponse getPublicOrOwnerListingDetail(UUID listingId, User viewer) {
        Listing listing = listings.findById(listingId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

        if (listing.getDeletedAt() != null) {
            throw new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable");
        }

        boolean owner = viewer != null && listing.getOwner().getId().equals(viewer.getId());
        boolean admin = viewer != null && viewer.getRole() == UserRole.ADMIN;
        boolean publicListing = listing.getStatus() == ListingStatus.PUBLISHED
                && listing.getAvailabilityState() == AvailabilityState.AVAILABLE;
        if (!owner && !admin && !publicListing) {
            throw new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable");
        }

        List<ListingPhotoResponse> photos = listingPhotos
                .findByListingIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAsc(listingId)
                .stream()
                .map(ListingPhotoResponse::from)
                .toList();
        return PublicListingDetailResponse.from(
                listing,
                LocationFuzzer.fuzz(listing.getId(), listing.getLatitude(), listing.getLongitude()),
                new HashSet<>(listingAmenities.findAmenityCodesByListingId(listingId)),
                photos);
    }

    public PublicListingResponse submit(UUID listingId, User owner) {
        Listing listing = requireOwnedListing(listingId, owner);
        if (listing.getStatus() != ListingStatus.DRAFT && listing.getStatus() != ListingStatus.REJECTED) {
            throw illegalTransition("DRAFT | REJECTED -> PENDING_REVIEW");
        }

        if (listing.getDescription() == null || listing.getDescription().isBlank()) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Description requise");
        }
        if (listingPhotos.findByListingIdAndDeletedAtIsNullOrderBySortOrderAscCreatedAtAsc(listingId).isEmpty()) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Au moins une photo est requise");
        }
        if (listing.getPropertyType() == null) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Type de logement requis");
        }
        if (listing.getRoomType() == null) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Type de chambre requis");
        }

        listing.setStatus(ListingStatus.PENDING_REVIEW);
        return PublicListingResponse.from(listings.save(listing),
                LocationFuzzer.fuzz(listing.getId(), listing.getLatitude(), listing.getLongitude()));
    }

    public PublicListingResponse markRoomFound(UUID listingId, User owner) {
        Listing listing = requireOwnedListing(listingId, owner);
        if (listing.getStatus() == ListingStatus.PUBLISHED && listing.getAvailabilityState() == AvailabilityState.AVAILABLE) {
            listing.setAvailabilityState(AvailabilityState.ROOM_FOUND);
            return PublicListingResponse.from(listings.save(listing),
                    LocationFuzzer.fuzz(listing.getId(), listing.getLatitude(), listing.getLongitude()));
        }
        throw illegalTransition("AVAILABLE -> ROOM_FOUND");
    }

    public PublicListingResponse reopen(UUID listingId, User owner) {
        Listing listing = requireOwnedListing(listingId, owner);
        if (listing.getStatus() == ListingStatus.PUBLISHED && listing.getAvailabilityState() == AvailabilityState.ROOM_FOUND) {
            listing.setAvailabilityState(AvailabilityState.AVAILABLE);
            return PublicListingResponse.from(listings.save(listing),
                    LocationFuzzer.fuzz(listing.getId(), listing.getLatitude(), listing.getLongitude()));
        }
        throw illegalTransition("ROOM_FOUND -> AVAILABLE");
    }

    private Listing requireOwnedListing(UUID listingId, User owner) {
        Listing listing = listings.findByIdAndOwnerIdAndDeletedAtIsNull(listingId, owner.getId())
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));
        return listing;
    }

    private ApiException illegalTransition(String message) {
        return new ApiException(409, ErrorCode.ILLEGAL_TRANSITION, "Transition illégale: " + message);
    }

    private <T extends Enum<T>> Set<T> parseEnumList(String[] rawValues, Class<T> enumType) {
        if (rawValues == null || rawValues.length == 0) {
            return Set.of();
        }

        Set<T> values = new java.util.HashSet<>();
        for (String raw : rawValues) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            for (String token : raw.split(",")) {
                String cleaned = token.trim();
                if (cleaned.isEmpty()) {
                    continue;
                }
                values.add(Enum.valueOf(enumType, cleaned.toUpperCase(Locale.ROOT)));
            }
        }
        return values;
    }

    private String[] normalizeValues(String[] rawValues) {
        if (rawValues == null || rawValues.length == 0) {
            return null;
        }
        Set<String> values = new LinkedHashSet<>();
        for (String rawValue : rawValues) {
            if (rawValue == null || rawValue.isBlank()) {
                continue;
            }
            for (String value : rawValue.split(",")) {
                String normalized = value.trim();
                if (!normalized.isEmpty()) {
                    values.add(normalized);
                }
            }
        }
        return values.isEmpty() ? null : values.toArray(String[]::new);
    }

    private String normalizeSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return "recommended";
        }
        String normalized = sort.trim().toLowerCase(Locale.ROOT).replace("_", "");
        return switch (normalized) {
            case "recommended", "recent", "newest" -> "recommended";
            case "priceasc", "priceascending" -> "priceasc";
            case "pricedesc", "pricedescending" -> "pricedesc";
            case "closest", "distance" -> "closest";
            case "updated" -> "updated";
            default -> "recommended";
        };
    }

    private String encodeCursor(UUID id, String sort) {
        ObjectNode payload = Cursor.newPayload();
        payload.put("sort", sort);
        payload.put("lastId", id.toString());
        return Cursor.encode(payload);
    }

    private double haversineMiles(double lat1, double lon1, double lat2, double lon2) {
        double earthRadius = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadius * c;
    }
}
