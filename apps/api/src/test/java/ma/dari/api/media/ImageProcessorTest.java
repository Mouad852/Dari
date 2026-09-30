package ma.dari.api.media;

import ma.dari.api.common.error.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.zip.CRC32;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertTimeout;

class ImageProcessorTest {
    @Test
    void validatesPixelsAndReencodesToJpeg() throws Exception {
        ImageProcessor.EncodedImage encoded = ImageProcessor.process(new MockMultipartFile(
                "file", "photo.png", "image/png", imageBytes("png")));

        assertThat(encoded.mimeType()).isEqualTo("image/jpeg");
        assertThat(encoded.width()).isEqualTo(320);
        assertThat(encoded.height()).isEqualTo(240);
        assertThat(ImageIO.read(new ByteArrayInputStream(encoded.bytes()))).isNotNull();
    }

    @Test
    void flattensPngTransparencyOntoWhiteNotBlack() throws Exception {
        BufferedImage transparent = new BufferedImage(320, 240, BufferedImage.TYPE_INT_ARGB); // every pixel alpha 0
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        assertThat(ImageIO.write(transparent, "png", png)).isTrue();

        ImageProcessor.EncodedImage encoded = ImageProcessor.process(new MockMultipartFile(
                "file", "logo.png", "image/png", png.toByteArray()));

        BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(encoded.bytes()));
        int rgb = decoded.getRGB(160, 120);
        // JPEG is lossy, so "white" is every channel near 255.
        assertThat(List.of((rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF)).allSatisfy(channel ->
                assertThat(channel).isGreaterThan(245));
    }

    /*
     * Stored 400x200: left half red, right half blue. Each case names where the red half must end
     * up once the EXIF Orientation is applied, and the upright size.
     */
    @ParameterizedTest(name = "orientation {0} ({1}) puts red at the {2}")
    @CsvSource({
            "6, MM, top,    200, 400",
            "6, II, top,    200, 400",
            "8, MM, bottom, 200, 400",
            "3, MM, right,  400, 200",
            "1, MM, left,   400, 200",
    })
    void rotatesJpegPixelsUprightFromExifOrientation(int orientation, String byteOrder, String redSide,
                                                     int width, int height) throws Exception {
        BufferedImage stored = new BufferedImage(400, 200, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = stored.createGraphics();
        graphics.setColor(Color.RED);
        graphics.fillRect(0, 0, 200, 200);
        graphics.setColor(Color.BLUE);
        graphics.fillRect(200, 0, 200, 200);
        graphics.dispose();
        ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
        assertThat(ImageIO.write(stored, "jpg", jpeg)).isTrue();

        ImageProcessor.EncodedImage encoded = ImageProcessor.process(new MockMultipartFile(
                "file", "portrait.jpg", "image/jpeg", withOrientation(jpeg.toByteArray(), orientation, byteOrder)));

        assertThat(encoded.width()).isEqualTo(width);
        assertThat(encoded.height()).isEqualTo(height);
        BufferedImage upright = ImageIO.read(new ByteArrayInputStream(encoded.bytes()));
        assertThat(upright.getWidth()).isEqualTo(width);
        int[] red = switch (redSide) {
            case "top" -> new int[]{width / 2, height / 4};
            case "bottom" -> new int[]{width / 2, height * 3 / 4};
            case "left" -> new int[]{width / 4, height / 2};
            default -> new int[]{width * 3 / 4, height / 2};
        };
        int[] blue = {width - 1 - red[0], height - 1 - red[1]};
        assertThat(isMostly(upright.getRGB(red[0], red[1]), 16)).as("red side").isTrue();
        assertThat(isMostly(upright.getRGB(blue[0], blue[1]), 0)).as("blue side").isTrue();
    }

    @Test
    void ignoresMalformedExifInsteadOfFailingTheUpload() throws Exception {
        byte[] truncated = withOrientation(imageBytes("jpg"), 6, "MM");
        truncated[2 + 4 + 6 + 4] = 0x7F; // IFD0 offset now points far past the segment

        ImageProcessor.EncodedImage encoded = ImageProcessor.process(new MockMultipartFile(
                "file", "photo.jpg", "image/jpeg", truncated));

        assertThat(encoded.width()).isEqualTo(320);
        assertThat(encoded.height()).isEqualTo(240);
    }

    @Test
    void rejectsHugePngFromItsHeaderBeforePixelDecode() {
        MockMultipartFile bomb = new MockMultipartFile(
                "file", "bomb.png", "image/png", pngHeader(30_000, 30_000));

        // No IDAT body is present. read() must not be reached: it would either fail as malformed or
        // attempt a multi-gigabyte allocation before discovering the missing image data.
        assertTimeout(Duration.ofSeconds(1), () -> assertThatThrownBy(() -> ImageProcessor.process(bomb))
                .isInstanceOfSatisfying(ApiException.class, error -> {
                    assertThat(error.status()).isEqualTo(400);
                    assertThat(error.getMessage()).isEqualTo("La photo ne peut pas dépasser 10000 px ni 25 mégapixels");
                }));
    }

    @Test
    void keepsJpegAndPngInputsAndStripsExifByReencoding() throws Exception {
        for (String format : new String[]{"jpg", "png"}) {
            ImageProcessor.EncodedImage encoded = ImageProcessor.process(new MockMultipartFile(
                    "file", "photo." + format, "image/" + (format.equals("jpg") ? "jpeg" : format), imageBytes(format)));
            assertThat(encoded.mimeType()).isEqualTo("image/jpeg");
            assertThat(encoded.width()).isEqualTo(320);
            assertThat(encoded.height()).isEqualTo(240);
        }

        ImageProcessor.EncodedImage withoutMetadata = ImageProcessor.process(new MockMultipartFile(
                "file", "photo.jpg", "image/jpeg", jpegWithExifMarker()));
        assertThat(new String(withoutMetadata.bytes(), StandardCharsets.ISO_8859_1))
                .doesNotContain("dari-private-gps");
    }

    @Test
    void doesNotAdvertiseUnsupportedGifOrWebp() throws Exception {
        assertThatThrownBy(() -> ImageProcessor.process(new MockMultipartFile(
                "file", "photo.gif", "image/gif", imageBytes("gif"))))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> ImageProcessor.process(new MockMultipartFile(
                "file", "photo.webp", "image/webp", new byte[]{1, 2, 3})))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void localAndS3StoresUseTheSameImageProcessorValidation(@TempDir Path uploadRoot) throws Exception {
        MockMultipartFile bomb = new MockMultipartFile(
                "file", "bomb.png", "image/png", pngHeader(5_001, 5_000));
        LocalImageStore local = new LocalImageStore(uploadRoot.toString());
        S3ImageStore s3 = new S3ImageStore("http://127.0.0.1:1", "eu-west-1", "access", "secret", "bucket", "/uploads",
                2000, 10000, "public, max-age=3600");

        for (ImageStore store : new ImageStore[]{local, s3}) {
            assertThatThrownBy(() -> store.store(ImageStore.LISTINGS, UUID.randomUUID(), bomb))
                    .isInstanceOfSatisfying(ApiException.class, error ->
                            assertThat(error.getMessage()).isEqualTo("La photo ne peut pas dépasser 10000 px ni 25 mégapixels"));
        }
        try (var files = Files.list(uploadRoot)) {
            assertThat(files.toList()).isEmpty();
        }
    }

    @Test
    void localStoreWritesTheSharedJpegEncoding(@TempDir Path uploadRoot) throws Exception {
        LocalImageStore local = new LocalImageStore(uploadRoot.toString());
        ImageStore.StoredImage stored = local.store(ImageStore.AVATARS, UUID.randomUUID(), new MockMultipartFile(
                "file", "photo.png", "image/png", imageBytes("png")));

        assertThat(stored.mimeType()).isEqualTo("image/jpeg");
        assertThat(stored.width()).isEqualTo(320);
        assertThat(stored.height()).isEqualTo(240);
        assertThat(ImageIO.read(uploadRoot.resolve(stored.storageKey()).toFile())).isNotNull();
    }

    private static byte[] imageBytes(String format) throws Exception {
        BufferedImage image = new BufferedImage(320, 240, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        assertThat(ImageIO.write(image, format, output)).isTrue();
        return output.toByteArray();
    }

    /** The JPEG with an EXIF APP1 holding only IFD0's Orientation tag, in the given TIFF byte order. */
    private static byte[] withOrientation(byte[] jpeg, int orientation, String byteOrder) {
        boolean intel = byteOrder.equals("II");
        byte[] tiff = intel
                ? new byte[]{'I', 'I', 0x2A, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, (byte) orientation, 0, 0, 0, 0, 0, 0, 0}
                : new byte[]{'M', 'M', 0, 0x2A, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, (byte) orientation, 0, 0, 0, 0, 0, 0};
        ByteArrayOutputStream output = new ByteArrayOutputStream(jpeg.length + tiff.length + 10);
        output.write(jpeg, 0, 2); // JPEG SOI
        output.write(0xFF);
        output.write(0xE1); // APP1
        int length = 2 + 6 + tiff.length;
        output.write(length >>> 8);
        output.write(length);
        output.writeBytes("Exif\u0000\u0000".getBytes(StandardCharsets.ISO_8859_1));
        output.writeBytes(tiff);
        output.write(jpeg, 2, jpeg.length - 2);
        return output.toByteArray();
    }

    /** True when the channel at {@code channelShift} dominates (JPEG blurs colours slightly). */
    private static boolean isMostly(int rgb, int channelShift) {
        for (int shift : new int[]{16, 8, 0}) {
            int value = (rgb >> shift) & 0xFF;
            if (shift == channelShift ? value < 180 : value > 90) return false;
        }
        return true;
    }

    private static byte[] jpegWithExifMarker() throws Exception {
        byte[] jpeg = imageBytes("jpg");
        byte[] payload = "Exif\u0000\u0000dari-private-gps".getBytes(StandardCharsets.ISO_8859_1);
        ByteArrayOutputStream output = new ByteArrayOutputStream(jpeg.length + payload.length + 4);
        output.write(jpeg, 0, 2); // JPEG SOI
        output.write(0xFF);
        output.write(0xE1); // APP1 / EXIF
        output.write((payload.length + 2) >>> 8);
        output.write(payload.length + 2);
        output.write(payload);
        output.write(jpeg, 2, jpeg.length - 2);
        return output.toByteArray();
    }

    private static byte[] pngHeader(int width, int height) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (DataOutputStream data = new DataOutputStream(output)) {
                data.write(new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
                data.writeInt(13);
                byte[] ihdr = new byte[17];
                ihdr[0] = 'I';
                ihdr[1] = 'H';
                ihdr[2] = 'D';
                ihdr[3] = 'R';
                ihdr[4] = (byte) (width >>> 24);
                ihdr[5] = (byte) (width >>> 16);
                ihdr[6] = (byte) (width >>> 8);
                ihdr[7] = (byte) width;
                ihdr[8] = (byte) (height >>> 24);
                ihdr[9] = (byte) (height >>> 16);
                ihdr[10] = (byte) (height >>> 8);
                ihdr[11] = (byte) height;
                ihdr[12] = 8; // bit depth
                ihdr[13] = 2; // RGB
                data.write(ihdr);
                CRC32 crc = new CRC32();
                crc.update(ihdr);
                data.writeInt((int) crc.getValue());
            }
            return output.toByteArray();
        } catch (Exception ex) {
            throw new AssertionError(ex);
        }
    }
}
