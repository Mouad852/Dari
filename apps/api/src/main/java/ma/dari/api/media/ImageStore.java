package ma.dari.api.media;

import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface ImageStore {
    StoredImage store(UUID listingId, MultipartFile file);

    void delete(String storageKey);

    record StoredImage(String storageKey, String mimeType, int width, int height) {
    }
}
