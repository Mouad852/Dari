package ma.dari.api.listing;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.common.pagination.Cursor;
import ma.dari.api.common.pagination.CursorPage;
import ma.dari.api.common.pagination.TypedCursors;
import ma.dari.api.user.User;
import ma.dari.api.media.ImageStore;
import ma.dari.api.user.UserRole;
import ma.dari.api.listing.dto.HouseRulesResponse;
import ma.dari.api.listing.dto.ListingPhotoResponse;
import ma.dari.api.listing.dto.ListingResponse;
import ma.dari.api.listing.dto.ListingRoomResponse;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;

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
import java.util.Map;
import java.util.HashMap;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Service
public class ListingSearchService {

    private static final int PAGE_SIZE = 20;

    /**
     * Hard cap on a single {@code /listings/map} response. See the query's own
     * javadoc in {@code ListingSearchRepository} for why this exists.
     */
    private static final int MAP_PIN_LIMIT = 1000;

    private final ListingRepository listings;
    private final ListingSearchRepository search;
    private final ListingAmenityRepository listingAmenities;
    private final ListingPhotoRepository listingPhotos;
    private final HouseRulesRepository houseRules;
    private final ListingRoomRepository rooms;
    private final ListingCovers covers;
    private final MeterRegistry meterRegistry;
    private final double fuzzRadiusM;
    private final LocationFuzzer locationFuzzer;
    private final ImageStore imageStore;

    public ListingSearchService(ListingRepository listings, ListingSearchRepository search,
                                ListingAmenityRepository listingAmenities, ListingPhotoRepository listingPhotos,
                                HouseRulesRepository houseRules, ListingRoomRepository rooms,
                                ListingCovers covers, MeterRegistry meterRegistry,
                                @Value("${dari.location.fuzz-radius-metres:200}") double fuzzRadiusM,
                                LocationFuzzer locationFuzzer,
                                ImageStore imageStore) {
        this.listings = listings;
        this.search = search;
        this.listingAmenities = listingAmenities;
        this.listingPhotos = listingPhotos;
        this.houseRules = houseRules;
        this.rooms = rooms;
        this.covers = covers;
        this.meterRegistry = meterRegistry;
        this.fuzzRadiusM = fuzzRadiusM;
        this.locationFuzzer = locationFuzzer;
        this.imageStore = imageStore;
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

        boolean radiusMode = ListingSearchValidation.validate(city, neighborhood, lat, lng, radiusM, sort,
                propertyType, roomType, furnishing, amenities, priceMin, priceMax);
        String effectiveSort = normalizeSort(sort);
        if (radiusMode && !"closest".equals(effectiveSort)) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED,
                    "Le tri par distance nécessite une recherche par rayon");
        }
        if (!radiusMode && "closest".equals(effectiveSort)) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED,
                    "Le tri par distance nécessite une recherche par rayon");
        }
        Timer.Sample searchTimerSample = Timer.start(meterRegistry);

        List<Listing> page;
        List<RadiusListingProjection> radiusRows = null;
        String nextCursor = null;

        // Convert price params to BigDecimal for SQL queries
        BigDecimal minPrice = priceMin == null ? null : BigDecimal.valueOf(priceMin);
        BigDecimal maxPrice = priceMax == null ? null : BigDecimal.valueOf(priceMax);

        // Normalize enum arrays: empty arrays are treated as null (no filter)
        String[] normalizedPropertyTypes = normalizeEnumValues(propertyType);
        String[] normalizedRoomTypes = normalizeEnumValues(roomType);
        String[] normalizedFurnishings = normalizeEnumValues(furnishing);
        String[] normalizedAmenities = normalizeValues(amenities);
        int amenityCount = normalizedAmenities != null ? normalizedAmenities.length : 0;
        String queryKey = searchQueryKey(city, neighborhood, normalizedPropertyTypes, normalizedRoomTypes,
                normalizedFurnishings, normalizedAmenities, availableFrom, priceMin, priceMax,
                lat, lng, radiusM, effectiveSort);

        try {
        if (lat != null && lng != null && radiusM != null) {
            // Radius search uses distance-based pagination
            if (!"closest".equalsIgnoreCase(normalizeSort(effectiveSort)) &&
                !"distance".equalsIgnoreCase(normalizeSort(effectiveSort))) {
                throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Le tri 'closest' ou 'distance' est obligatoire pour la recherche par rayon");
            }

            // Distance sort requires a different cursor format: distance + id
            if (cursor != null && !cursor.isBlank()) {
                TypedCursors.SearchCursor decoded = TypedCursors.search(cursor, queryKey, effectiveSort, true);
                UUID lastId = decoded.lastId();

                if (lastId != null) {
                    // For cursor pagination in distance mode, we need the actual distance of the last item
                    // Query to get it from the last listing
                    double lastDistance = decoded.lastDistance().doubleValue();

                    radiusRows = search.searchByRadiusWithCursor(
                            lat, lng, radiusM,
                            city, neighborhood,
                            minPrice, maxPrice,
                            normalizedPropertyTypes, normalizedRoomTypes, normalizedFurnishings,
                            availableFrom, normalizedAmenities, amenityCount,
                            lastDistance, lastId,
                            PAGE_SIZE + 1
                    );
                } else {
                    radiusRows = search.searchByRadiusPaginated(
                            lat, lng, radiusM,
                            city, neighborhood,
                            minPrice, maxPrice,
                            normalizedPropertyTypes, normalizedRoomTypes, normalizedFurnishings,
                            availableFrom, normalizedAmenities, amenityCount,
                            PAGE_SIZE + 1
                    );
                }
            } else {
                radiusRows = search.searchByRadiusPaginated(
                        lat, lng, radiusM,
                        city, neighborhood,
                        minPrice, maxPrice,
                        normalizedPropertyTypes, normalizedRoomTypes, normalizedFurnishings,
                        availableFrom, normalizedAmenities, amenityCount,
                        PAGE_SIZE + 1
                );
            }

            page = hydrateRadiusRows(radiusRows);
            if (radiusRows.size() > PAGE_SIZE) {
                RadiusListingProjection last = radiusRows.get(PAGE_SIZE - 1);
                ObjectNode cursorPayload = JsonNodeFactory.instance.objectNode();
                cursorPayload.put("lastId", last.getListingId().toString());
                cursorPayload.put("mode", "radius");
                cursorPayload.put("sort", effectiveSort);
                cursorPayload.put("queryKey", queryKey);
                cursorPayload.put("lastDistance", Double.toString(last.getDistanceMetres()));
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
                TypedCursors.SearchCursor decoded = TypedCursors.search(cursor, queryKey, activeSort, false);
                lastId = decoded.lastId();
                lastPrice = decoded.lastPrice();
                lastCreatedAt = decoded.lastCreatedAt() == null ? null : decoded.lastCreatedAt().atOffset(java.time.ZoneOffset.UTC);
                lastUpdatedAt = decoded.lastUpdatedAt() == null ? null : decoded.lastUpdatedAt().atOffset(java.time.ZoneOffset.UTC);
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
                cursorPayload.put("mode", "location");
                cursorPayload.put("queryKey", queryKey);
                cursorPayload.put("lastId", lastListing.getId().toString());
                cursorPayload.put("lastPrice", lastListing.getPriceRent().toPlainString());
                cursorPayload.put("lastCreatedAt", lastListing.getCreatedAt().toString());
                cursorPayload.put("lastUpdatedAt", lastListing.getUpdatedAt().toString());
                nextCursor = Cursor.encode(cursorPayload);
                page = page.subList(0, PAGE_SIZE);
            }
        }

        // Map listings to responses with fuzzed coordinates and their cover photo
        java.util.Map<UUID, String> coverUrls = covers.forEach(page);
        List<PublicListingResponse> items = page.stream()
                .map(l -> PublicListingResponse.from(l,
                        locationFuzzer.fuzz(l.getId(), l.getLatitude(), l.getLongitude(), fuzzRadiusM),
                        coverUrls.get(l.getId())))
                .toList();

        return CursorPage.of(items, nextCursor);
        } finally {
            searchTimerSample.stop(meterRegistry.timer("dari.search.latency", "mode", radiusMode ? "radius" : "location"));
        }
    }

    /**
     * Counts matches for a filter set, up to {@link SearchCountResponse#CAP}.
     *
     * <p>Reuses the search queries with a capped limit rather than adding a
     * dedicated COUNT query. The filter predicate is already repeated across
     * ListingSearchRepository; a seventh copy would be one more place for a
     * future filter fix to miss, and the count would then silently disagree with
     * the results it labels — which is worse than no count at all.
     *
     * <p>Belongs to a filter set, not a page: callers fetch it when filters
     * change, never while paginating.
     */
    public SearchCountResponse count(String city,
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
                                      Integer radiusM) {
        ListingSearchValidation.validate(city, neighborhood, lat, lng, radiusM, null,
                propertyType, roomType, furnishing, amenities, priceMin, priceMax);
        if ((city != null || neighborhood != null) && (lat != null || lng != null || radiusM != null)) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "La ville, le quartier et le rayon ne peuvent pas être combinés");
        }
        if (radiusM != null && radiusM > 50_000) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Rayon trop large");
        }

        String[] normalizedPropertyTypes = normalizeEnumValues(propertyType);
        String[] normalizedRoomTypes = normalizeEnumValues(roomType);
        String[] normalizedFurnishings = normalizeEnumValues(furnishing);
        String[] normalizedAmenities = normalizeValues(amenities);
        int amenityCount = normalizedAmenities != null ? normalizedAmenities.length : 0;
        BigDecimal minPrice = priceMin == null ? null : BigDecimal.valueOf(priceMin);
        BigDecimal maxPrice = priceMax == null ? null : BigDecimal.valueOf(priceMax);

        // One past the cap, so "more than CAP" is distinguishable from "exactly CAP".
        int probe = SearchCountResponse.CAP + 1;

        int matchingRows = (lat != null && lng != null && radiusM != null)
                ? search.searchByRadiusPaginated(
                        lat, lng, radiusM, city, neighborhood, minPrice, maxPrice,
                        normalizedPropertyTypes, normalizedRoomTypes, normalizedFurnishings,
                        availableFrom, normalizedAmenities, amenityCount, probe)
                .size()
                : search.searchByLocationSorted(
                        city, neighborhood, minPrice, maxPrice,
                         normalizedPropertyTypes, normalizedRoomTypes, normalizedFurnishings,
                         availableFrom, normalizedAmenities, amenityCount,
                         "recommended", null, null, null, null, probe).size();
        return SearchCountResponse.of(matchingRows);
    }

    /**
     * Cover photo URLs for a page of listings, in one query.
     *
     * <p>Search returns twenty rows at a time; resolving covers one listing at a
     * time would be twenty round trips on the busiest endpoint in the product.
     */

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
        ListingSearchValidation.validate(city, neighborhood, lat, lng, radiusM, null,
                propertyType, roomType, furnishing, amenities, priceMin, priceMax);
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
        String[] normalizedPropertyTypes = normalizeEnumValues(propertyType);
        String[] normalizedRoomTypes = normalizeEnumValues(roomType);
        String[] normalizedFurnishings = normalizeEnumValues(furnishing);
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
                lat, lng, radiusM, MAP_PIN_LIMIT
        );

        return listings_.stream()
                .map(l -> MapPinResponse.from(l, locationFuzzer.fuzz(l.getId(), l.getLatitude(), l.getLongitude(), fuzzRadiusM)))
                .toList();
    }

    public List<PublicListingResponse> featured(int limit) {
        int normalizedLimit = Math.max(1, Math.min(limit <= 0 ? 6 : limit, 12));

        // Use PostGIS query instead of loading all listings into memory
        List<Listing> featured = search.featuredListings(normalizedLimit);

        java.util.Map<UUID, String> featuredCovers = covers.forEach(featured);
        return featured.stream()
                .map(l -> PublicListingResponse.from(l,
                        locationFuzzer.fuzz(l.getId(), l.getLatitude(), l.getLongitude(), fuzzRadiusM),
                        featuredCovers.get(l.getId())))
                .toList();
    }

    public long sitemapCount() {
        return search.countSitemapRows();
    }

    public List<SitemapEntry> sitemapBatch(int limit, int offset) {
        if (limit < 1 || limit > 50_000 || offset < 0) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Lot de sitemap invalide");
        }
        return search.sitemapBatch(limit, offset).stream()
                .map(row -> new SitemapEntry(row.getId(), row.getUpdatedAt()))
                .toList();
    }

    public PublicListingResponse getPublicOrOwnerListing(UUID listingId, User viewer) {
        Listing listing = listings.findByIdAndDeletedAtIsNull(listingId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

        if (viewer != null && listing.getOwner().getId().equals(viewer.getId())) {
            return PublicListingResponse.from(listing, locationFuzzer.fuzz(listing.getId(), listing.getLatitude(), listing.getLongitude(), fuzzRadiusM), covers.forListing(listing.getId()));
        }

        // Moderators review PENDING_REVIEW/SUSPENDED listings that belong to
        // someone else; without this, the admin console's own "view listing"
        // link 404s on exactly the listings it exists to review.
        if (viewer != null && viewer.getRole() == UserRole.ADMIN) {
            return PublicListingResponse.from(listing, locationFuzzer.fuzz(listing.getId(), listing.getLatitude(), listing.getLongitude(), fuzzRadiusM), covers.forListing(listing.getId()));
        }

        if (listing.getStatus() == ListingStatus.PUBLISHED
                && listing.getAvailabilityState() == AvailabilityState.AVAILABLE) {
            return PublicListingResponse.from(listing, locationFuzzer.fuzz(listing.getId(), listing.getLatitude(), listing.getLongitude(), fuzzRadiusM), covers.forListing(listing.getId()));
        }

        throw new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable");
    }

    public PublicListingDetailResponse getPublicOrOwnerListingDetail(UUID listingId, User viewer) {
        Listing listing = listings.findByIdAndDeletedAtIsNull(listingId)
                .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Annonce introuvable"));

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
                .map(photo -> ListingPhotoResponse.from(photo, imageStore.publicUrl(photo.getStorageKey())))
                .toList();
        HouseRulesResponse houseRulesResponse = houseRules.findById(listingId)
                .map(HouseRulesResponse::from)
                .orElse(null);
        List<ListingRoomResponse> roomResponses = rooms.findByListingIdOrderByCreatedAtAsc(listingId)
                .stream()
                .map(ListingRoomResponse::from)
                .toList();
        return PublicListingDetailResponse.from(
                listing,
                locationFuzzer.fuzz(listing.getId(), listing.getLatitude(), listing.getLongitude(), fuzzRadiusM),
                new HashSet<>(listingAmenities.findAmenityCodesByListingId(listingId)),
                photos,
                houseRulesResponse,
                roomResponses);
    }

    public ListingResponse submit(UUID listingId, User owner) {
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
        // A lifecycle confirmation, not a card: the client already has the
        // listing on screen and re-reading its cover, house rules, or room list
        // here would be a query for data nothing renders. Null is the
        // deliberate answer, not an oversight.
        Listing saved = listings.save(listing);
        return ListingResponse.from(saved, new HashSet<>(listingAmenities.findAmenityCodesByListingId(saved.getId())), null, null, null);
    }

    public ListingResponse renew(UUID listingId, User owner) {
        Listing listing = requireOwnedListing(listingId, owner);
        if (listing.getStatus() != ListingStatus.EXPIRED) {
            throw illegalTransition("EXPIRED -> PENDING_REVIEW");
        }

        listing.setStatus(ListingStatus.PENDING_REVIEW);
        listing.setRejectionReason(null);
        listing.setExpiryWarnedAt(null);
        Listing saved = listings.save(listing);
        return ListingResponse.from(saved, new HashSet<>(listingAmenities.findAmenityCodesByListingId(saved.getId())), null, null, null);
    }

    public ListingResponse markRoomFound(UUID listingId, User owner) {
        Listing listing = requireOwnedListing(listingId, owner);
        if (listing.getStatus() == ListingStatus.PUBLISHED && listing.getAvailabilityState() == AvailabilityState.AVAILABLE) {
            listing.setAvailabilityState(AvailabilityState.ROOM_FOUND);
            Listing saved = listings.save(listing);
            return ListingResponse.from(saved, new HashSet<>(listingAmenities.findAmenityCodesByListingId(saved.getId())), null, null, null);
        }
        throw illegalTransition("AVAILABLE -> ROOM_FOUND");
    }

    public ListingResponse reopen(UUID listingId, User owner) {
        Listing listing = requireOwnedListing(listingId, owner);
        if (listing.getStatus() == ListingStatus.PUBLISHED && listing.getAvailabilityState() == AvailabilityState.ROOM_FOUND) {
            listing.setAvailabilityState(AvailabilityState.AVAILABLE);
            Listing saved = listings.save(listing);
            return ListingResponse.from(saved, new HashSet<>(listingAmenities.findAmenityCodesByListingId(saved.getId())), null, null, null);
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

    private String[] normalizeEnumValues(String[] rawValues) {
        String[] values = normalizeValues(rawValues);
        if (values == null) return null;
        return java.util.Arrays.stream(values).map(value -> value.toUpperCase(Locale.ROOT)).toArray(String[]::new);
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

    private List<Listing> hydrateRadiusRows(List<RadiusListingProjection> rows) {
        if (rows == null || rows.isEmpty()) return List.of();
        Map<UUID, Listing> byId = listings.findAllById(rows.stream().map(RadiusListingProjection::getListingId).toList())
                .stream().collect(java.util.stream.Collectors.toMap(Listing::getId, listing -> listing));
        return rows.stream().map(row -> byId.get(row.getListingId())).filter(java.util.Objects::nonNull).toList();
    }

    private String searchQueryKey(String city, String neighborhood, String[] propertyTypes, String[] roomTypes,
                                  String[] furnishings, String[] amenities, LocalDate availableFrom,
                                  Integer priceMin, Integer priceMax, Double lat, Double lng, Integer radiusM,
                                  String sort) {
        String raw = String.join("|", String.valueOf(city), String.valueOf(neighborhood),
                java.util.Arrays.toString(propertyTypes), java.util.Arrays.toString(roomTypes),
                java.util.Arrays.toString(furnishings), java.util.Arrays.toString(amenities),
                String.valueOf(availableFrom), String.valueOf(priceMin), String.valueOf(priceMax),
                String.valueOf(lat), String.valueOf(lng), String.valueOf(radiusM), String.valueOf(sort));
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte value : digest) result.append(String.format("%02x", value));
            return result.toString();
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private String encodeCursor(UUID id, String sort) {
        ObjectNode payload = Cursor.newPayload();
        payload.put("sort", sort);
        payload.put("lastId", id.toString());
        return Cursor.encode(payload);
    }

}
