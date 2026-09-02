package ma.dari.api.media;

import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface ImageStore {

    /** Storage folder for listing photos. */
    String LISTINGS = "listings";

    /** Storage folder for profile avatars. */
    String AVATARS = "avatars";

    /**
     * Stores an image under {@code folder/ownerId/}, re-encoded.
     *
     * <p>The folder is a parameter rather than two near-identical methods
     * because the pipeline itself is the point: re-encoding is what strips EXIF,
     * and a profile photo is as likely to have been taken at home as a listing
     * photo. A separate avatar path would eventually drift from this one.
     */
    StoredImage store(String folder, UUID ownerId, MultipartFile file);

    void delete(String storageKey);

    record StoredImage(String storageKey, String mimeType, int width, int height) {
    }
}
