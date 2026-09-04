package ma.dari.api.listing.dto;

import ma.dari.api.listing.AvailabilityState;
import ma.dari.api.listing.ChargeInclusion;
import ma.dari.api.listing.Listing;
import ma.dari.api.listing.ListingStatus;
import ma.dari.api.listing.PropertyType;
import ma.dari.api.listing.RoomFurnishing;
import ma.dari.api.listing.RoomType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * A listing as its owner and a moderator see it: unfuzzed coordinates, the
 * fields the wizard writes, and the moderation state.
 *
 * `coverPhotoUrl` is the late addition. Only {@link ma.dari.api.listing.PublicListingResponse}
 * carried a cover, so `/admin/listings` and `/account/listings` both rendered
 * the design system's PHOTO placeholder for listings that had a real
 * photograph. On the owner's own list that is cosmetic. In the moderation queue
 * it is not: a moderator was deciding approve-or-reject without ever seeing the
 * photograph, which is the single most likely thing to be wrong with a listing.
 *
 * The factory takes it as a parameter rather than looking it up, because this
 * record has no repository, and it is a required third argument rather than an
 * overload on purpose — an overload would let a caller keep compiling against
 * the old two-argument form and silently go on showing the placeholder, which
 * is exactly the failure being fixed.
 */
public record ListingResponse(
        UUID id,
        String title,
        String city,
        String neighborhood,
        Double latitude,
        Double longitude,
        BigDecimal priceRent,
        BigDecimal priceDeposit,
        String description,
        ChargeInclusion wifiIncluded,
        ChargeInclusion electricityIncluded,
        ChargeInclusion waterIncluded,
        PropertyType propertyType,
        Short numBedrooms,
        Short numBathrooms,
        RoomType roomType,
        RoomFurnishing roomFurnishing,
        Boolean commonAreasFurnished,
        Short currentRoommatesCount,
        Short maxRoommates,
        LocalDate availableFrom,
        Short minStayMonths,
        ListingStatus status,
        AvailabilityState availabilityState,
        Instant createdAt,
        Instant updatedAt,
        String rejectionReason,
        Set<String> amenityCodes,
        /** Root-relative, e.g. /uploads/listings/{id}/{photo}.jpg. Null when the listing has no photo. */
        String coverPhotoUrl
) {
    public static ListingResponse from(Listing listing, Set<String> amenityCodes, String coverPhotoUrl) {
        return new ListingResponse(
                listing.getId(),
                listing.getTitle(),
                listing.getCity(),
                listing.getNeighborhood(),
                listing.getLatitude(),
                listing.getLongitude(),
                listing.getPriceRent(),
                listing.getPriceDeposit(),
                listing.getDescription(),
                listing.getWifiIncluded(),
                listing.getElectricityIncluded(),
                listing.getWaterIncluded(),
                listing.getPropertyType(),
                listing.getNumBedrooms(),
                listing.getNumBathrooms(),
                listing.getRoomType(),
                listing.getRoomFurnishing(),
                listing.getCommonAreasFurnished(),
                listing.getCurrentRoommatesCount(),
                listing.getMaxRoommates(),
                listing.getAvailableFrom(),
                listing.getMinStayMonths(),
                listing.getStatus(),
                listing.getAvailabilityState(),
                listing.getCreatedAt(),
                listing.getUpdatedAt(),
                listing.getRejectionReason(),
                amenityCodes,
                coverPhotoUrl
        );
    }
}
