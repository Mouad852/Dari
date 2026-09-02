package ma.dari.api.common.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

/**
 * Stamps every request with a correlation id, in MDC for log correlation and
 * echoed on the response so a client can hand it back when reporting an issue.
 *
 * <p>Ordered ahead of Spring Security's filter chain (which runs at
 * {@code SecurityProperties.DEFAULT_FILTER_ORDER}, -100) so the id is already
 * in MDC by the time {@link ma.dari.api.common.auth.FirebaseAuthFilter} logs
 * anything, and by the time an unhandled exception reaches
 * {@link ma.dari.api.common.error.GlobalExceptionHandler}.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Correlation-Id";
    private static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String id = Optional.ofNullable(request.getHeader(HEADER))
                .filter(h -> !h.isBlank())
                .orElseGet(() -> UUID.randomUUID().toString());

        MDC.put(MDC_KEY, id);
        response.setHeader(HEADER, id);
        try {
            chain.doFilter(request, response);
        } finally {
            // Thread pools reuse threads; a leaked id attaches one request's
            // correlation to another's logs.
            MDC.remove(MDC_KEY);
        }
    }
}
