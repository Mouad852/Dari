package ma.dari.api.media;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MediaAccessInterceptorTest {

    @Test
    void percentEncodedRevokedKeyIsBlockedAfterOneDecode() throws Exception {
        MediaCleanupRepository cleanups = mock(MediaCleanupRepository.class);
        when(cleanups.existsByStorageKey("listings/owner/photo.jpg")).thenReturn(true);
        MediaAccessInterceptor interceptor = new MediaAccessInterceptor(cleanups);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/uploads/listings%2Fowner%2Fphoto.jpg");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThat(interceptor.preHandle(request, response, new Object())).isFalse();
        assertThat(response.getStatus()).isEqualTo(404);
        verify(cleanups).existsByStorageKey("listings/owner/photo.jpg");
    }

    @Test
    void revocationDoesNotDependOnTheRowStatus() throws Exception {
        // PENDING, DEAD and DELETED all revoke. A DEAD row's file is still on
        // disk, which is exactly when hiding it matters; the lookup therefore
        // never filters by status, so no status can slip through it.
        MediaCleanupRepository cleanups = mock(MediaCleanupRepository.class);
        when(cleanups.existsByStorageKey("avatars/owner/dead.jpg")).thenReturn(true);
        MediaAccessInterceptor interceptor = new MediaAccessInterceptor(cleanups);
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertThat(interceptor.preHandle(new MockHttpServletRequest("GET", "/uploads/avatars/owner/dead.jpg"),
                response, new Object())).isFalse();
        assertThat(response.getStatus()).isEqualTo(404);
        verify(cleanups, never()).existsByStorageKeyAndStatus(anyString(), any());
    }

    @Test
    void aKeyWithNoCleanupRowIsServed() throws Exception {
        MediaCleanupRepository cleanups = mock(MediaCleanupRepository.class);
        MediaAccessInterceptor interceptor = new MediaAccessInterceptor(cleanups);

        assertThat(interceptor.preHandle(new MockHttpServletRequest("GET", "/uploads/avatars/owner/live.jpg"),
                new MockHttpServletResponse(), new Object())).isTrue();
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
