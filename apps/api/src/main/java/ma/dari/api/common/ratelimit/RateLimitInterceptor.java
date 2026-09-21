package ma.dari.api.common.ratelimit;

import ma.dari.api.common.auth.AuthenticatedUser;
import ma.dari.api.common.error.RateLimitExceededException;
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
import java.util.Arrays;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RateLimitService rateLimitService;

    public RateLimitInterceptor(RateLimitService rateLimitService) {
        this.rateLimitService = rateLimitService;
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

        String identity = identity();
        if (identity != null) {
            check(annotation.value(), "user:" + identity);
        }
        check(annotation.value(), "ip:" + sourceAddress(request.getRemoteAddr()));
        return true;
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
