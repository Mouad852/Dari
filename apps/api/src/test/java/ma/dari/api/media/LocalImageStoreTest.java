package ma.dari.api.media;

import ma.dari.api.common.error.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalImageStoreTest {

    @Test
    void localStoreNeverDeletesOutsideItsUploadRoot(@TempDir Path uploadRoot) throws Exception {
        LocalImageStore local = new LocalImageStore(uploadRoot.toString());
        Path outside = uploadRoot.getParent().resolve("must-not-delete.jpg");
        Files.writeString(outside, "keep");

        assertThatThrownBy(() -> local.delete("../must-not-delete.jpg"))
                .isInstanceOf(ApiException.class);

        assertThat(Files.exists(outside)).isTrue();
    }
}
