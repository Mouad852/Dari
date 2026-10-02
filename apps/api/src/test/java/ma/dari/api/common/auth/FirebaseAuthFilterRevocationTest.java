package ma.dari.api.common.auth;

import com.google.firebase.ErrorCode;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import ma.dari.api.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.json.JsonMapper;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/** A revoked or disabled Firebase account stops working within minutes, not an hour (audit P2-10). */
class FirebaseAuthFilterRevocationTest {

    private final FirebaseAuth firebaseAuth = Mockito.mock(FirebaseAuth.class);
    private final UserRepository users = Mockito.mock(UserRepository.class);
    private final FirebaseAuthFilter filter = new FirebaseAuthFilter(firebaseAuth, users, JsonMapper.builder().build());

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private FirebaseToken token(String uid) throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(firebaseAuth.verifyIdToken("id-token")).thenReturn(token);
        Mockito.when(users.findByFirebaseUid(uid)).thenReturn(Optional.empty());
        return token;
    }

    private MockHttpServletResponse call() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users/me");
        request.addHeader("Authorization", "Bearer id-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    private static FirebaseAuthException authError(ErrorCode code, AuthErrorCode authCode) {
        return new FirebaseAuthException(code, "test", null, null, authCode);
    }

    @Test
    void aRevokedTokenIsRefused() throws Exception {
        token("uid-revoked");
        Mockito.when(firebaseAuth.verifyIdToken(anyString(), eq(true)))
                .thenThrow(authError(ErrorCode.INVALID_ARGUMENT, AuthErrorCode.REVOKED_ID_TOKEN));

        MockHttpServletResponse response = call();

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("INVALID_TOKEN");
    }

    @Test
    void aDisabledAccountIsRefused() throws Exception {
        token("uid-disabled");
        Mockito.when(firebaseAuth.verifyIdToken(anyString(), eq(true)))
                .thenThrow(authError(ErrorCode.INVALID_ARGUMENT, AuthErrorCode.USER_DISABLED));

        assertThat(call().getStatus()).isEqualTo(401);
    }

    @Test
    void aGoodTokenIsCheckedOncePerInterval() throws Exception {
        FirebaseToken token = token("uid-good");
        Mockito.when(firebaseAuth.verifyIdToken(anyString(), eq(true))).thenReturn(token);

        assertThat(call().getStatus()).isEqualTo(200);
        assertThat(call().getStatus()).isEqualTo(200);
        assertThat(call().getStatus()).isEqualTo(200);

        verify(firebaseAuth, times(3)).verifyIdToken("id-token");
        verify(firebaseAuth, times(1)).verifyIdToken("id-token", true);
    }

    @Test
    void anUnreachableFirebaseDoesNotSignEveryoneOutAndIsAskedAgain() throws Exception {
        FirebaseToken token = token("uid-outage");
        Mockito.when(firebaseAuth.verifyIdToken(anyString(), eq(true)))
                .thenThrow(authError(ErrorCode.UNAVAILABLE, null))
                .thenReturn(token);

        assertThat(call().getStatus()).isEqualTo(200);
        assertThat(call().getStatus()).isEqualTo(200);
        assertThat(call().getStatus()).isEqualTo(200);

        verify(firebaseAuth, times(2)).verifyIdToken("id-token", true);
    }

    @Test
    void anInvalidTokenNeverReachesTheRevocationCheck() throws Exception {
        Mockito.when(firebaseAuth.verifyIdToken("id-token"))
                .thenThrow(authError(ErrorCode.INVALID_ARGUMENT, AuthErrorCode.INVALID_ID_TOKEN));

        assertThat(call().getStatus()).isEqualTo(401);
        verify(firebaseAuth, never()).verifyIdToken(anyString(), eq(true));
    }
}
