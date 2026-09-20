package ma.dari.api.listing.dto;

import ma.dari.api.listing.ListingPhoto;

import java.time.Instant;
import java.util.UUID;

public record ListingPhotoResponse(
        UUID id,
        String url,
        String mimeType,
        Integer width,
        Integer height,
        Integer sortOrder,
        boolean isCover,
        Instant createdAt
) {
    public static ListingPhotoResponse from(ListingPhoto photo) {
        return from(photo, "/uploads/" + photo.getStorageKey());
    }

    public static ListingPhotoResponse from(ListingPhoto photo, String url) {
        return new ListingPhotoResponse(
                photo.getId(),
                url,
                photo.getMimeType(),
                photo.getWidth(),
                photo.getHeight(),
                photo.getSortOrder(),
                photo.isCover(),
                photo.getCreatedAt()
        );
    }
}
