package ma.dari.api.listing;

import ma.dari.api.listing.dto.HouseRulesResponse;
import ma.dari.api.listing.dto.ListingRoomResponse;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Amenities, house rules and rooms for a page of listings, in three queries
 * (audit P2-9).
 *
 * <p>The owner dashboard and the moderation queue built each row with three
 * lookups of their own, so a page of twenty listings cost sixty round trips
 * before the response left. Same output as the single-listing lookups in
 * {@link ListingService}: amenity codes as a set, house rules or null, rooms
 * in creation order.
 */
@Component
public class ListingExtras {

    public record Extras(Set<String> amenityCodes, HouseRulesResponse houseRules, List<ListingRoomResponse> rooms) {
        static final Extras NONE = new Extras(Set.of(), null, List.of());
    }

    private final ListingAmenityRepository amenities;
    private final HouseRulesRepository houseRules;
    private final ListingRoomRepository rooms;

    public ListingExtras(ListingAmenityRepository amenities, HouseRulesRepository houseRules, ListingRoomRepository rooms) {
        this.amenities = amenities;
        this.houseRules = houseRules;
        this.rooms = rooms;
    }

    /** Keyed by listing id; a listing with nothing attached maps to empty extras. */
    public Map<UUID, Extras> forEach(List<Listing> listings) {
        if (listings.isEmpty()) return Map.of();
        List<UUID> ids = listings.stream().map(Listing::getId).toList();

        Map<UUID, Set<String>> codes = new HashMap<>();
        for (Object[] row : amenities.findListingIdAndAmenityCodeByListingIdIn(ids)) {
            codes.computeIfAbsent((UUID) row[0], id -> new HashSet<>()).add((String) row[1]);
        }
        Map<UUID, HouseRulesResponse> rules = new HashMap<>();
        for (HouseRules row : houseRules.findAllById(ids)) {
            rules.put(row.getListingId(), HouseRulesResponse.from(row));
        }
        Map<UUID, List<ListingRoomResponse>> roomsByListing = new HashMap<>();
        for (ListingRoom room : rooms.findByListingIdInOrderByCreatedAtAsc(ids)) {
            roomsByListing.computeIfAbsent(room.getListing().getId(), id -> new ArrayList<>()).add(ListingRoomResponse.from(room));
        }

        Map<UUID, Extras> result = new HashMap<>();
        for (UUID id : ids) {
            result.put(id, new Extras(codes.getOrDefault(id, Set.of()), rules.get(id),
                    List.copyOf(roomsByListing.getOrDefault(id, List.of()))));
        }
        return result;
    }
}
