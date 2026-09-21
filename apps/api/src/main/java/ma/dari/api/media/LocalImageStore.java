package ma.dari.api.media;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Component
@ConditionalOnProperty(name = "dari.media.provider", havingValue = "local", matchIfMissing = true)
public class LocalImageStore implements ImageStore {

    private final Path uploadRoot;

    public LocalImageStore(@Value("${dari.upload-dir:./uploads}") String uploadDir) throws IOException {
        this.uploadRoot = Path.of(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(this.uploadRoot);
    }

    @Override
    public StoredImage store(String folder, UUID ownerId, MultipartFile file) {
        ImageProcessor.EncodedImage encoded = ImageProcessor.process(file);
        try {
            String storageKey = folder + "/" + ownerId + "/" + UUID.randomUUID() + ".jpg";
            Path target = uploadRoot.resolve(storageKey).normalize();
            Path parent = target.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.write(target, encoded.bytes());
            return new StoredImage(storageKey, encoded.mimeType(), encoded.width(), encoded.height());
        } catch (IOException ex) {
            throw new ApiException(500, ErrorCode.INTERNAL_ERROR, "L'enregistrement de la photo a échoué");
        }
    }

    @Override
    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            return;
        }
        Path file = uploadRoot.resolve(storageKey).normalize();
        try {
            Files.deleteIfExists(file);
        } catch (IOException ex) {
            throw new ApiException(503, ErrorCode.INTERNAL_ERROR, "La suppression de la photo a échoué");
        }
    }
}
