package ma.dari.api.listing;

import ma.dari.api.listing.dto.ListingPhotoResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public record PublicListingDetailResponse(
        UUID id,
        String title,
        String city,
        String neighborhood,
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
        LocalDate availableFrom,
        Short minStayMonths,
        double latitude,
        double longitude,
        AvailabilityState availabilityState,
        Instant createdAt,
        Set<String> amenityCodes,
        List<ListingPhotoResponse> photos) {

    public static PublicListingDetailResponse from(
            Listing listing,
            double[] fuzzed,
            Set<String> amenityCodes,
            List<ListingPhotoResponse> photos) {
        return new PublicListingDetailResponse(
                listing.getId(),
                listing.getTitle(),
                listing.getCity(),
                listing.getNeighborhood(),
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
                listing.getAvailableFrom(),
                listing.getMinStayMonths(),
                fuzzed[0],
                fuzzed[1],
                listing.getAvailabilityState(),
                listing.getCreatedAt(),
                amenityCodes,
                photos);
    }
}
