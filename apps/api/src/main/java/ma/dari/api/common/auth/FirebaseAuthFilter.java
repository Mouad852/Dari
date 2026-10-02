package ma.dari.api.common.auth;

import tools.jackson.databind.ObjectMapper;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.common.error.ErrorResponse;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import ma.dari.api.user.UserStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Verifies the Firebase ID token and attaches the principal.
 *
 * <p>Three deliberate properties:
 * <ul>
 *   <li>An absent Authorization header is not an error — public endpoints exist.
 *       Authorization is decided downstream, not here.</li>
 *   <li>A banned account is rejected here, before any controller runs.
 *       Per-endpoint checks eventually miss one.</li>
 *   <li>A suspended account is authenticated for GET, HEAD, and OPTIONS only.
 *       All mutating requests are rejected as read-only.</li>
 *   <li>This filter never creates the internal user row. Creating it lazily
 *       would hide a real client bug and perform a write as a side effect of a
 *       GET.</li>
 * </ul>
 */
@Component
public class FirebaseAuthFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(FirebaseAuthFilter.class);

    private static final String BEARER = "Bearer ";

    /**
     * How long one revocation check holds for a uid (audit P2-10). Without it a
     * disabled Firebase account, or one whose sessions were revoked, kept
     * working until its ID token expired, up to an hour. Checking on every
     * request would cost a Firebase round trip each time; once per uid per
     * interval bounds the window at one lookup per active user. The lookup is
     * free on the Spark plan and only counts against the Admin API quota.
     */
    static final Duration REVOCATION_CHECK_INTERVAL = Duration.ofMinutes(5);
    private static final int MAX_TRACKED_UIDS = 10_000;
    private static final Set<AuthErrorCode> REVOKED = EnumSet.of(
            AuthErrorCode.REVOKED_ID_TOKEN, AuthErrorCode.USER_DISABLED, AuthErrorCode.USER_NOT_FOUND);

    private final Map<String, Instant> revocationCheckedAt = new ConcurrentHashMap<>();

    private final FirebaseAuth firebaseAuth;
    private final UserRepository users;
    private final ObjectMapper mapper;

    public FirebaseAuthFilter(FirebaseAuth firebaseAuth, UserRepository users, ObjectMapper mapper) {
        this.firebaseAuth = firebaseAuth;
        this.users = users;
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith(BEARER)) {
            chain.doFilter(request, response);
            return;
        }

        FirebaseToken token;
        try {
            token = verify(header.substring(BEARER.length()));
        } catch (FirebaseAuthException e) {
            writeError(response, 401, ErrorCode.INVALID_TOKEN, "Session expirée");
            return;
        }

        Optional<User> user = users.findByFirebaseUid(token.getUid());

        if (user.isPresent() && user.get().getStatus() == UserStatus.BANNED) {
            writeError(response, 403, ErrorCode.ACCOUNT_BANNED, "Ce compte a été fermé");
            return;
        }

        if (user.isPresent() && user.get().getStatus() == UserStatus.SUSPENDED) {
            String method = request.getMethod();
            boolean readOnly = "GET".equalsIgnoreCase(method)
                    || "HEAD".equalsIgnoreCase(method)
                    || "OPTIONS".equalsIgnoreCase(method);
            // A suspension limits what someone does on Dari, not their right to
            // leave it: deleting their own account stays open (audit P2-11).
            boolean leaving = "DELETE".equalsIgnoreCase(method)
                    && "/api/v1/users/me".equals(request.getRequestURI().substring(request.getContextPath().length()));
            if (!readOnly && !leaving) {
                writeError(response, 403, ErrorCode.ACCOUNT_SUSPENDED,
                        "Ce compte est suspendu (lecture seule)");
                return;
            }
        }

        // A deleted account stops working immediately, not whenever its token
        // happens to expire. Deleting the Firebase identity does not invalidate
        // already-issued ID tokens, so without this check someone could keep
        // using the app for up to an hour after asking to be removed.
        if (user.isPresent() && user.get().getDeletedAt() != null) {
            writeError(response, 401, ErrorCode.UNAUTHENTICATED, "Ce compte a été supprimé");
            return;
        }

        var principal = new AuthenticatedUser(
                token.getUid(), token.getEmail(), token.isEmailVerified(), user.orElse(null));

        // A verified identity without a profile still carries an authority, so
        // POST /users stays reachable while GET /users/me correctly 404s.
        List<GrantedAuthority> authorities = user
                .<List<GrantedAuthority>>map(u -> List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())))
                .orElseGet(() -> List.of(new SimpleGrantedAuthority("ROLE_PROFILELESS")));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, authorities));

        chain.doFilter(request, response);
    }

    /**
     * Verifies the token's signature and expiry locally, then, at most once per
     * {@link #REVOCATION_CHECK_INTERVAL} per uid, asks Firebase whether it was
     * revoked or the account disabled. If Firebase cannot answer, the request
     * goes through on the local check and the next one asks again: an outage
     * must not sign everyone out.
     */
    private FirebaseToken verify(String idToken) throws FirebaseAuthException {
        FirebaseToken token = firebaseAuth.verifyIdToken(idToken);
        Instant now = Instant.now();
        Instant checkedAt = revocationCheckedAt.get(token.getUid());
        if (checkedAt != null && checkedAt.isAfter(now.minus(REVOCATION_CHECK_INTERVAL))) {
            return token;
        }
        try {
            firebaseAuth.verifyIdToken(idToken, true);
        } catch (FirebaseAuthException e) {
            if (REVOKED.contains(e.getAuthErrorCode())) {
                revocationCheckedAt.remove(token.getUid());
                throw e;
            }
            log.warn("Token revocation check unavailable ({}); accepting the locally verified token",
                    e.getErrorCode());
            return token;
        }
        if (revocationCheckedAt.size() >= MAX_TRACKED_UIDS) {
            revocationCheckedAt.values().removeIf(at -> !at.isAfter(now.minus(REVOCATION_CHECK_INTERVAL)));
            if (revocationCheckedAt.size() >= MAX_TRACKED_UIDS) {
                revocationCheckedAt.clear();
            }
        }
        revocationCheckedAt.put(token.getUid(), now);
        return token;
    }

    /** Filter failures bypass @RestControllerAdvice, so the envelope is kept by hand. */
    private void writeError(HttpServletResponse response, int status, ErrorCode code, String message)
            throws IOException {
        SecurityContextHolder.clearContext();
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        mapper.writeValue(response.getWriter(), ErrorResponse.of(code, message));
    }
}
