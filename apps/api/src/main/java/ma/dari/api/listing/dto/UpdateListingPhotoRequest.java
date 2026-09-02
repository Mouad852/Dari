package ma.dari.api.listing.dto;

import jakarta.validation.constraints.Min;

public record UpdateListingPhotoRequest(
        @Min(value = 0, message = "L'ordre de tri doit être positif ou nul")
        Integer sortOrder,
        Boolean isCover
) {
}
