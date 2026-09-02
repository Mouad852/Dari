package ma.dari.api.common.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.common.error.ErrorResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * What an anonymous request to a protected route gets back.
 *
 * <p>Without this, Spring's default for a chain with no login mechanism is a
 * bodyless 403 — wrong on both counts. The status should be 401 (the caller may
 * retry with credentials), and every failure this API produces carries the same
 * envelope, or clients end up with one error shape they can parse and another
 * they cannot.
 *
 * <p>The message matches {@link CurrentUserArgumentResolver}'s on purpose. The
 * two layers reject the same situation and a caller should not be able to tell
 * which one fired.
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper mapper;

    public RestAuthenticationEntryPoint(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {

        response.setStatus(401);
        // RFC 7235 requires a challenge on a 401, and Dari's is a bearer token.
        // It doubles as the only observable difference between a rejection here
        // and the identical-looking one CurrentUserArgumentResolver raises inside
        // the controller — which is what lets a test prove the security chain,
        // not just the resolver, is guarding owner-scoped routes.
        response.setHeader("WWW-Authenticate", "Bearer");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        mapper.writeValue(response.getWriter(),
                ErrorResponse.of(ErrorCode.UNAUTHENTICATED, "Connexion requise"));
    }
}
