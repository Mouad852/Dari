package ma.dari.api.media;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.UUID;

@Component
public class LocalImageStore implements ImageStore {

    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp"
    );
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024L * 1024L;

    private final Path uploadRoot;

    public LocalImageStore(@Value("${dari.upload-dir:./uploads}") String uploadDir) throws IOException {
        this.uploadRoot = Path.of(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(this.uploadRoot);
    }

    @Override
    public StoredImage store(String folder, UUID ownerId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Une photo est requise");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "La photo doit faire moins de 5 Mo");
        }
        String mimeType = file.getContentType();
        if (mimeType == null || !ALLOWED_MIME_TYPES.contains(mimeType)) {
            throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Type de fichier non pris en charge");
        }

        try (InputStream in = file.getInputStream()) {
            BufferedImage original = ImageIO.read(in);
            if (original == null) {
                throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "Le fichier n'est pas une image valide");
            }

            int width = original.getWidth();
            int height = original.getHeight();
            if (width < 200 || height < 200) {
                throw new ApiException(400, ErrorCode.VALIDATION_FAILED, "La photo doit mesurer au moins 200 px de large et de haut");
            }

            String storedMimeType = "image/jpeg";
            String storageKey = folder + "/" + ownerId + "/" + UUID.randomUUID() + ".jpg";
            Path target = uploadRoot.resolve(storageKey).normalize();
            Path parent = target.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }

            BufferedImage safeImage = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = safeImage.createGraphics();
            try {
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                graphics.drawImage(original, 0, 0, width, height, null);
            } finally {
                graphics.dispose();
            }
            if (!ImageIO.write(safeImage, "jpg", target.toFile())) {
                throw new ApiException(500, ErrorCode.INTERNAL_ERROR, "L'enregistrement de la photo a échoué");
            }

            return new StoredImage(storageKey, storedMimeType, width, height);
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
        } catch (IOException ignored) {
            // Best-effort cleanup; database already handles the row state.
        }
    }
}
