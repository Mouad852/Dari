package ma.dari.api.common.ratelimit;

import ma.dari.api.common.auth.AuthenticatedUser;
import ma.dari.api.common.error.RateLimitExceededException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    /**
     * Carries the web runtime's server-only shared secret. Deliberately absent
     * from the CORS allow-list, and never logged, echoed or tagged.
     */
    static final String SSR_KEY_HEADER = "X-Dari-Ssr-Key";

    private final RateLimitService rateLimitService;
    /** Null when unconfigured: then no request is ever a trusted SSR call. */
    private final byte[] ssrSharedSecret;

    public RateLimitInterceptor(RateLimitService rateLimitService,
                                @Value("${dari.ssr.shared-secret:}") String ssrSharedSecret) {
        this.rateLimitService = rateLimitService;
        this.ssrSharedSecret = ssrSharedSecret == null || ssrSharedSecret.isBlank()
                ? null
                : ssrSharedSecret.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod method)) {
            return true;
        }
        RateLimited annotation = method.getMethodAnnotation(RateLimited.class);
        if (annotation == null) {
            return true;
        }

        RateLimitType type = annotation.value();
        String identity = identity();

        if (isRead(type) && isTrustedSsrCall(request)) {
            // Every Next.js server render arrives from the web runtime's own
            // address and carries no trustworthy visitor address, so keyed
            // reads share one site-wide protective ceiling instead of the web
            // host's per-IP quota. A signed-in visitor keeps an independent
            // identity limit.
            if (identity != null) {
                check(RateLimitType.SSR_READ, "user:" + identity);
            }
            check(RateLimitType.SSR_READ, "shared:ssr-read");
            return true;
        }

        // Browsers, the mobile app and anyone without the key: the ordinary
        // per-IP (and per-user) limit. An SSR_READ endpoint falls back to
        // SEARCH, so an unkeyed caller can neither spend the shared SSR budget
        // nor enumerate outside a per-address quota.
        RateLimitType effective = type == RateLimitType.SSR_READ ? RateLimitType.SEARCH : type;
        if (identity != null) {
            check(effective, "user:" + identity);
        }
        check(effective, "ip:" + sourceAddress(request.getRemoteAddr()));
        return true;
    }

    /** Mutation policies never consult the SSR key. */
    private static boolean isRead(RateLimitType type) {
        return type == RateLimitType.SEARCH || type == RateLimitType.SSR_READ;
    }

    private boolean isTrustedSsrCall(HttpServletRequest request) {
        if (ssrSharedSecret == null) return false;
        String presented = request.getHeader(SSR_KEY_HEADER);
        // Constant time with respect to the configured secret's contents.
        return presented != null
                && MessageDigest.isEqual(presented.getBytes(StandardCharsets.UTF_8), ssrSharedSecret);
    }

    private void check(RateLimitType type, String dimension) {
        RateLimitService.Decision decision = rateLimitService.tryAcquire(type, dimension);
        if (!decision.allowed()) {
            throw new RateLimitExceededException(decision.retryAfterSeconds());
        }
    }

    private String identity() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser principal) {
            return principal.firebaseUid();
        }
        return null;
    }

    /**
     * Residential IPv6 clients commonly receive a changing interface suffix.
     * Grouping them by /64 prevents that suffix from becoming a cheap rate-limit
     * bypass while leaving IPv4 and malformed container-provided values intact.
     */
    private String sourceAddress(String remoteAddress) {
        try {
            String addressWithoutPort = stripForwardedClientPort(remoteAddress);
            InetAddress address = InetAddress.getByName(addressWithoutPort);
            if (!(address instanceof Inet6Address)) return addressWithoutPort;

            byte[] network = address.getAddress();
            Arrays.fill(network, 8, network.length, (byte) 0);
            return InetAddress.getByAddress(network).getHostAddress() + "/64";
        } catch (UnknownHostException invalidAddress) {
            return remoteAddress;
        }
    }

    /**
     * ALB can append client ports: {@code 192.0.2.1:443} for IPv4 and
     * {@code [2001:db8::1]:443} for IPv6. Ports are connection metadata, not
     * a client identity dimension.
     */
    private String stripForwardedClientPort(String remoteAddress) {
        if (remoteAddress.startsWith("[")) {
            int closingBracket = remoteAddress.indexOf(']');
            if (closingBracket > 1 && closingBracket + 1 < remoteAddress.length()
                    && remoteAddress.charAt(closingBracket + 1) == ':') {
                return remoteAddress.substring(1, closingBracket);
            }
        }

        int colon = remoteAddress.lastIndexOf(':');
        if (colon > 0 && remoteAddress.indexOf(':') == colon
                && remoteAddress.substring(colon + 1).chars().allMatch(Character::isDigit)) {
            return remoteAddress.substring(0, colon);
        }
        return remoteAddress;
    }
}
