package ma.dari.api.common.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import ma.dari.api.common.error.ErrorCode;
import ma.dari.api.common.error.ErrorResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * What an authenticated caller without the required role gets back — a
 * non-admin reaching {@code /api/v1/admin/**}, most of all.
 *
 * <p>The status was already correct by default; the body was empty. That is the
 * difference between a client showing "vous n'avez pas accès" and showing a
 * generic failure, since the web client reads the envelope's message.
 *
 * <p>Deliberately says nothing about what was being protected. A 403 that
 * explains the missing role is a hint to whoever is probing.
 */
@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper mapper;

    public RestAccessDeniedHandler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {

        response.setStatus(403);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        mapper.writeValue(response.getWriter(),
                ErrorResponse.of(ErrorCode.FORBIDDEN, "Accès refusé"));
    }
}
