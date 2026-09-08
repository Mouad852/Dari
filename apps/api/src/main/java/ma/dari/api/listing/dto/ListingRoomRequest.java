package ma.dari.api.listing.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ma.dari.api.listing.ListingRoomType;

/**
 * One room submitted with a listing create or patch (§3 {@code listing_rooms}).
 *
 * <p>The list this belongs to on {@link CreateListingRequest}/{@link UpdateListingRequest}
 * is a full replace, same rule and same reason as {@code amenityCodes}: the
 * wizard's "Pièces" step submits every room every time, so a per-room merge
 * would leave no way to remove a room that was previously added.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ListingRoomRequest(
        @NotNull(message = "Le type de pièce est requis")
        ListingRoomType roomType,
        boolean isRentable,
        boolean isShared,

        @Size(max = 500, message = "500 caractères maximum")
        String description) {
}
