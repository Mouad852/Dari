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
        Set<String> amenityCodes
) {
    public static ListingResponse from(Listing listing, Set<String> amenityCodes) {
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
                amenityCodes
        );
    }
}
