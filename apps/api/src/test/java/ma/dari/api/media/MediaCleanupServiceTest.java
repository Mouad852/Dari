package ma.dari.api.media;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class MediaCleanupServiceTest {
    @Test
    void failedDeletionStaysPendingWithRetryState() {
        MediaCleanupRepository repository = mock(MediaCleanupRepository.class);
        ImageStore imageStore = mock(ImageStore.class);
        MediaCleanup cleanup = new MediaCleanup("listings/one/photo.jpg");
        doThrow(new RuntimeException("remote unavailable")).when(imageStore).delete(cleanup.getStorageKey());
        when(repository.findDue(eq(MediaCleanupStatus.PENDING), any(Instant.class), any(Pageable.class)))
                .thenReturn(List.of(cleanup));

        new MediaCleanupService(repository, imageStore).processDue();

        verify(repository).save(cleanup);
        org.assertj.core.api.Assertions.assertThat(cleanup.getStatus()).isEqualTo(MediaCleanupStatus.PENDING);
        org.assertj.core.api.Assertions.assertThat(cleanup.getAttempts()).isEqualTo(1);
        org.assertj.core.api.Assertions.assertThat(cleanup.getLastError()).contains("remote unavailable");
    }
}
