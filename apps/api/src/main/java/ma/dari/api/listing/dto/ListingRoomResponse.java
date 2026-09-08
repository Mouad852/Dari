package ma.dari.api.listing.dto;

import ma.dari.api.listing.ListingRoom;
import ma.dari.api.listing.ListingRoomType;

import java.util.UUID;

public record ListingRoomResponse(
        UUID id,
        ListingRoomType roomType,
        boolean isRentable,
        boolean isShared,
        String description) {

    public static ListingRoomResponse from(ListingRoom room) {
        return new ListingRoomResponse(
                room.getId(),
                room.getRoomType(),
                room.isRentable(),
                room.isShared(),
                room.getDescription());
    }
}
