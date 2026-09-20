package ma.dari.api.media;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Set;

/** Shared byte validation and JPEG re-encoding for every ImageStore adapter. */
public final class ImageProcessor {
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/png");
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024L * 1024L;
    private static final int MAX_IMAGE_DIMENSION = 10_000;
    private static final long MAX_IMAGE_PIXELS = 40_000_000L;

    private ImageProcessor() {
    }

    public static EncodedImage process(MultipartFile file) {
        if (file == null || file.isEmpty()) throw invalid("Une photo est requise");
        if (file.getSize() > MAX_FILE_SIZE_BYTES) throw invalid("La photo doit faire moins de 5 Mo");
        if (file.getContentType() == null || !ALLOWED_MIME_TYPES.contains(file.getContentType())) {
            throw invalid("Type de fichier non pris en charge");
        }
        try (InputStream in = file.getInputStream()) {
            BufferedImage original = ImageIO.read(in);
            if (original == null) throw invalid("Le fichier n'est pas une image valide");
            int width = original.getWidth();
            int height = original.getHeight();
            if (width < 200 || height < 200) throw invalid("La photo doit mesurer au moins 200 px de large et de haut");
            if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || (long) width * height > MAX_IMAGE_PIXELS) {
                throw invalid("La photo ne peut pas dépasser 10000 px ni 40 mégapixels");
            }
            BufferedImage safeImage = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = safeImage.createGraphics();
            try {
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                graphics.drawImage(original, 0, 0, width, height, null);
            } finally {
                graphics.dispose();
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            if (!ImageIO.write(safeImage, "jpg", bytes)) throw new IOException("JPEG writer unavailable");
            return new EncodedImage(bytes.toByteArray(), "image/jpeg", width, height);
        } catch (IOException ex) {
            throw new ApiException(500, ErrorCode.INTERNAL_ERROR, "L'enregistrement de la photo a échoué");
        }
    }

    private static ApiException invalid(String message) {
        return new ApiException(400, ErrorCode.VALIDATION_FAILED, message);
    }

    public record EncodedImage(byte[] bytes, String mimeType, int width, int height) {
    }
}
