package ma.dari.api.media;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImageProcessorTest {
    @Test
    void validatesPixelsAndReencodesToJpeg() throws Exception {
        BufferedImage image = new BufferedImage(320, 240, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream input = new ByteArrayOutputStream();
        ImageIO.write(image, "png", input);

        ImageProcessor.EncodedImage encoded = ImageProcessor.process(new MockMultipartFile(
                "file", "photo.png", "image/png", input.toByteArray()));

        assertThat(encoded.mimeType()).isEqualTo("image/jpeg");
        assertThat(encoded.width()).isEqualTo(320);
        assertThat(encoded.height()).isEqualTo(240);
        assertThat(ImageIO.read(new java.io.ByteArrayInputStream(encoded.bytes()))).isNotNull();
    }

    @Test
    void doesNotAdvertiseUnsupportedWebp() {
        assertThatThrownBy(() -> ImageProcessor.process(new MockMultipartFile(
                "file", "photo.webp", "image/webp", new byte[]{1, 2, 3})))
                .isInstanceOf(ma.dari.api.common.error.ApiException.class);
    }
}
