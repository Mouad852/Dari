package ma.dari.api.media;

import ma.dari.api.common.error.ApiException;
import ma.dari.api.common.error.ErrorCode;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;
import java.util.Set;

/** Shared byte validation and JPEG re-encoding for every ImageStore adapter. */
public final class ImageProcessor {
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/png");
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024L * 1024L;
    private static final int MAX_IMAGE_DIMENSION = 10_000;
    // 25 MP accommodates modern phone photos while capping one upload's decoded RGB buffer at ~100 MB.
    private static final long MAX_IMAGE_PIXELS = 25_000_000L;

    private ImageProcessor() {
    }

    public static EncodedImage process(MultipartFile file) {
        if (file == null || file.isEmpty()) throw invalid("Une photo est requise");
        if (file.getSize() > MAX_FILE_SIZE_BYTES) throw invalid("La photo doit faire moins de 5 Mo");
        if (file.getContentType() == null || !ALLOWED_MIME_TYPES.contains(file.getContentType())) {
            throw invalid("Type de fichier non pris en charge");
        }
        int orientation = readOrientation(file);
        try (InputStream in = file.getInputStream();
             ImageInputStream imageInput = ImageIO.createImageInputStream(in)) {
            if (imageInput == null) throw invalid("Le fichier n'est pas une image valide");

            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInput);
            if (!readers.hasNext()) throw invalid("Le fichier n'est pas une image valide");

            ImageReader reader = readers.next();
            try {
                reader.setInput(imageInput, true, true);
                // The reader exposes dimensions from the header. Validate them before read() can allocate pixels.
                validateDimensions(reader.getWidth(0), reader.getHeight(0));

                BufferedImage original = reader.read(0);
                if (original == null) throw invalid("Le fichier n'est pas une image valide");
                validateDimensions(original.getWidth(), original.getHeight());
                // Orientations 5-8 turn the picture a quarter, swapping its sides.
                boolean quarterTurn = orientation >= 5;
                int width = quarterTurn ? original.getHeight() : original.getWidth();
                int height = quarterTurn ? original.getWidth() : original.getHeight();

                BufferedImage safeImage = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
                Graphics2D graphics = safeImage.createGraphics();
                try {
                    graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                    // JPEG has no alpha: a transparent PNG pixel drawn onto the zeroed RGB buffer comes out black.
                    graphics.setColor(Color.WHITE);
                    graphics.fillRect(0, 0, width, height);
                    graphics.drawImage(original, uprightTransform(orientation, original.getWidth(), original.getHeight()), null);
                } finally {
                    graphics.dispose();
                }
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                if (!ImageIO.write(safeImage, "jpg", bytes)) throw new IOException("JPEG writer unavailable");
                return new EncodedImage(bytes.toByteArray(), "image/jpeg", width, height);
            } finally {
                reader.dispose();
            }
        } catch (IOException ex) {
            throw new ApiException(500, ErrorCode.INTERNAL_ERROR, "L'enregistrement de la photo a échoué");
        }
    }

    /** Only JPEG carries the EXIF tag in practice; a PNG, or any read failure, is drawn as stored. */
    private static int readOrientation(MultipartFile file) {
        if (!"image/jpeg".equals(file.getContentType())) return ExifOrientation.NORMAL;
        try (InputStream in = file.getInputStream()) {
            return ExifOrientation.read(in);
        } catch (IOException ex) {
            return ExifOrientation.NORMAL;
        }
    }

    /**
     * Maps stored pixels (w x h) to the upright picture the EXIF Orientation value describes:
     * x' = m00*x + m01*y + m02, y' = m10*x + m11*y + m12. The constructor takes them in the order
     * (m00, m10, m01, m11, m02, m12).
     */
    static AffineTransform uprightTransform(int orientation, int w, int h) {
        return switch (orientation) {
            case 2 -> new AffineTransform(-1, 0, 0, 1, w, 0);   // mirrored horizontally
            case 3 -> new AffineTransform(-1, 0, 0, -1, w, h);  // rotated 180°
            case 4 -> new AffineTransform(1, 0, 0, -1, 0, h);   // mirrored vertically
            case 5 -> new AffineTransform(0, 1, 1, 0, 0, 0);    // transposed
            case 6 -> new AffineTransform(0, 1, -1, 0, h, 0);   // needs 90° clockwise
            case 7 -> new AffineTransform(0, -1, -1, 0, h, w);  // transversed
            case 8 -> new AffineTransform(0, -1, 1, 0, 0, w);   // needs 90° counter-clockwise
            default -> new AffineTransform();
        };
    }

    private static void validateDimensions(int width, int height) {
        if (width < 200 || height < 200) {
            throw invalid("La photo doit mesurer au moins 200 px de large et de haut");
        }
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION
                || (long) width * height > MAX_IMAGE_PIXELS) {
            throw invalid("La photo ne peut pas dépasser 10000 px ni 25 mégapixels");
        }
    }

    private static ApiException invalid(String message) {
        return new ApiException(400, ErrorCode.VALIDATION_FAILED, message);
    }

    public record EncodedImage(byte[] bytes, String mimeType, int width, int height) {
    }
}
