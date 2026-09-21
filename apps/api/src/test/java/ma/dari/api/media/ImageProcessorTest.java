package ma.dari.api.media;

import ma.dari.api.common.error.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
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
        S3ImageStore s3 = new S3ImageStore("http://127.0.0.1:1", "eu-west-1", "access", "secret", "bucket", "/uploads");

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

    @Test
    void localStoreNeverDeletesOutsideItsUploadRoot(@TempDir Path uploadRoot) throws Exception {
        LocalImageStore local = new LocalImageStore(uploadRoot.toString());
        Path outside = uploadRoot.getParent().resolve("must-not-delete.jpg");
        Files.writeString(outside, "keep");

        assertThatThrownBy(() -> local.delete("../must-not-delete.jpg"))
                .isInstanceOf(ApiException.class);

        assertThat(Files.exists(outside)).isTrue();
    }

    private static byte[] imageBytes(String format) throws Exception {
        BufferedImage image = new BufferedImage(320, 240, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        assertThat(ImageIO.write(image, format, output)).isTrue();
        return output.toByteArray();
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
