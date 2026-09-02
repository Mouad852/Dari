package ma.dari.api.common.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.List;
import java.util.Optional;

/**
 * Verifies the Firebase ID token and attaches the principal.
 *
 * <p>Three deliberate properties:
 * <ul>
 *   <li>An absent Authorization header is not an error — public endpoints exist.
 *       Authorization is decided downstream, not here.</li>
 *   <li>A banned account is rejected here, before any controller runs.
 *       Per-endpoint checks eventually miss one.</li>
 *   <li>This filter never creates the internal user row. Creating it lazily
 *       would hide a real client bug and perform a write as a side effect of a
 *       GET.</li>
 * </ul>
 */
@Component
public class FirebaseAuthFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";

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
            token = firebaseAuth.verifyIdToken(header.substring(BEARER.length()));
        } catch (FirebaseAuthException e) {
            writeError(response, 401, ErrorCode.INVALID_TOKEN, "Session expirée");
            return;
        }

        Optional<User> user = users.findByFirebaseUid(token.getUid());

        if (user.isPresent() && user.get().getStatus() == UserStatus.BANNED) {
            writeError(response, 403, ErrorCode.ACCOUNT_BANNED, "Ce compte a été fermé");
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
