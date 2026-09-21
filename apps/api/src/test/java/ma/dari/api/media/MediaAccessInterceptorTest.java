package ma.dari.api.media;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MediaAccessInterceptorTest {

    @Test
    void percentEncodedPendingKeyIsBlockedAfterOneDecode() throws Exception {
        MediaCleanupRepository cleanups = mock(MediaCleanupRepository.class);
        when(cleanups.existsByStorageKeyAndStatus("listings/owner/photo.jpg", MediaCleanupStatus.PENDING)).thenReturn(true);
        MediaAccessInterceptor interceptor = new MediaAccessInterceptor(cleanups);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/uploads/listings%2Fowner%2Fphoto.jpg");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThat(interceptor.preHandle(request, response, new Object())).isFalse();
        assertThat(response.getStatus()).isEqualTo(404);
        verify(cleanups).existsByStorageKeyAndStatus("listings/owner/photo.jpg", MediaCleanupStatus.PENDING);
    }

    @Test
    void rejectsSingleEncodedTraversalBeforeLookup() throws Exception {
        MediaCleanupRepository cleanups = mock(MediaCleanupRepository.class);
        MediaAccessInterceptor interceptor = new MediaAccessInterceptor(cleanups);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/uploads/%2e%2e%2fsecret.jpg");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThat(interceptor.preHandle(request, response, new Object())).isFalse();
        assertThat(response.getStatus()).isEqualTo(404);
    }

    @Test
    void rejectsDoubleEncodedTraversalBeforeLookup() throws Exception {
        MediaCleanupRepository cleanups = mock(MediaCleanupRepository.class);
        MediaAccessInterceptor interceptor = new MediaAccessInterceptor(cleanups);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/uploads/%252e%252e%252Fsecret.jpg");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThat(interceptor.preHandle(request, response, new Object())).isFalse();
        assertThat(response.getStatus()).isEqualTo(404);
    }

    @Test
    void rejectsNulPathAsANotFoundInsteadOfThrowing() throws Exception {
        MediaCleanupRepository cleanups = mock(MediaCleanupRepository.class);
        MediaAccessInterceptor interceptor = new MediaAccessInterceptor(cleanups);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/uploads/listings%2Fowner%2Fphoto%00.jpg");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThat(interceptor.preHandle(request, response, new Object())).isFalse();
        assertThat(response.getStatus()).isEqualTo(404);
    }
}
