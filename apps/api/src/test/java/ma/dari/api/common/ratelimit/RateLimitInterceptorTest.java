package ma.dari.api.common.ratelimit;

import ma.dari.api.common.auth.AuthenticatedUser;
import ma.dari.api.common.error.RateLimitExceededException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.method.HandlerMethod;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThat;

class RateLimitInterceptorTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void doesNotUseOneGlobalAnonymousBucketForSearch() throws Exception {
        RateLimitService service = new RateLimitService(
                5, Duration.ofHours(1),
                30, Duration.ofMinutes(1),
                5, Duration.ofHours(1),
                20, Duration.ofHours(1),
                5, Duration.ofHours(1),
                2, Duration.ofHours(1));
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service);
        HandlerMethod handler = new HandlerMethod(new SearchEndpoint(), SearchEndpoint.class.getMethod("search"));

        MockHttpServletRequest firstAddress = new MockHttpServletRequest();
        firstAddress.setRemoteAddr("192.0.2.10");
        MockHttpServletRequest secondAddress = new MockHttpServletRequest();
        secondAddress.setRemoteAddr("192.0.2.11");

        interceptor.preHandle(firstAddress, new MockHttpServletResponse(), handler);
        interceptor.preHandle(secondAddress, new MockHttpServletResponse(), handler);
        interceptor.preHandle(firstAddress, new MockHttpServletResponse(), handler);
        interceptor.preHandle(secondAddress, new MockHttpServletResponse(), handler);
    }

    @Test
    void appliesAnnotationAndRejectsTheSixthSignupAttempt() throws Exception {
        RateLimitService service = new RateLimitService(
                5, Duration.ofHours(1),
                30, Duration.ofMinutes(1),
                5, Duration.ofHours(1),
                20, Duration.ofHours(1),
                5, Duration.ofHours(1),
                120, Duration.ofMinutes(1));
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new AuthenticatedUser("uid-rate-test", "rate@example.ma", true, null),
                        null));

        HandlerMethod handler = new HandlerMethod(new SignupEndpoint(), SignupEndpoint.class.getMethod("signup"));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");

        for (int attempt = 0; attempt < 5; attempt++) {
            interceptor.preHandle(request, new MockHttpServletResponse(), handler);
        }

        assertThatThrownBy(() -> interceptor.preHandle(request, new MockHttpServletResponse(), handler))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void groupsIpv6PrivacyAddressesIntoOneSlash64Bucket() throws Exception {
        RateLimitService service = new RateLimitService(
                5, Duration.ofHours(1), 30, Duration.ofMinutes(1), 5, Duration.ofHours(1),
                20, Duration.ofHours(1), 1, Duration.ofHours(1), 120, Duration.ofMinutes(1));
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service);
        HandlerMethod handler = new HandlerMethod(new SignupEndpoint(), SignupEndpoint.class.getMethod("signup"));
        MockHttpServletRequest first = new MockHttpServletRequest();
        first.setRemoteAddr("2001:db8:1234:5678::1");
        MockHttpServletRequest second = new MockHttpServletRequest();
        second.setRemoteAddr("[2001:db8:1234:5678::2]:41001");

        assertThatCode(() -> interceptor.preHandle(first, new MockHttpServletResponse(), handler)).doesNotThrowAnyException();
        assertThatThrownBy(() -> interceptor.preHandle(second, new MockHttpServletResponse(), handler))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void ignoresAlbAppendedClientPortsWhenBuildingAddressBuckets() throws Exception {
        RateLimitService service = new RateLimitService(
                5, Duration.ofHours(1), 30, Duration.ofMinutes(1), 5, Duration.ofHours(1),
                20, Duration.ofHours(1), 1, Duration.ofHours(1), 120, Duration.ofMinutes(1));
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service);
        HandlerMethod handler = new HandlerMethod(new SignupEndpoint(), SignupEndpoint.class.getMethod("signup"));
        MockHttpServletRequest first = new MockHttpServletRequest();
        first.setRemoteAddr("203.0.113.7:41000");
        MockHttpServletRequest second = new MockHttpServletRequest();
        second.setRemoteAddr("203.0.113.7:41001");

        interceptor.preHandle(first, new MockHttpServletResponse(), handler);
        assertThatThrownBy(() -> interceptor.preHandle(second, new MockHttpServletResponse(), handler))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void generousSharedSsrReadCeilingDoesNotThrottleOrdinaryRenderedTraffic() throws Exception {
        RateLimitService service = new RateLimitService(
                5, Duration.ofHours(1), 30, Duration.ofMinutes(1), 5, Duration.ofHours(1),
                20, Duration.ofHours(1), 5, Duration.ofHours(1), 120, Duration.ofMinutes(1));
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service);
        HandlerMethod handler = new HandlerMethod(new SsrReadEndpoint(), SsrReadEndpoint.class.getMethod("read"));

        for (int request = 0; request < 121; request++) {
            MockHttpServletRequest renderedRequest = new MockHttpServletRequest();
            // Distinct source addresses model visitors behind the Next.js
            // runtime: all use the one shared SSR policy, never SEARCH's 120/IP.
            renderedRequest.setRemoteAddr("198.51.100." + (request % 250));
            assertThatCode(() -> interceptor.preHandle(renderedRequest, new MockHttpServletResponse(), handler))
                    .doesNotThrowAnyException();
        }
    }

    @Test
    void ssrReadKeepsAnAuthenticatedUserDimensionAlongsideTheSharedCeiling() throws Exception {
        RateLimitService service = new RateLimitService(
                5, Duration.ofHours(1), 30, Duration.ofMinutes(1), 5, Duration.ofHours(1),
                20, Duration.ofHours(1), 5, Duration.ofHours(1), 120, Duration.ofMinutes(1));
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service);
        HandlerMethod handler = new HandlerMethod(new SsrReadEndpoint(), SsrReadEndpoint.class.getMethod("read"));
        MockHttpServletRequest request = new MockHttpServletRequest();

        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser("uid-ssr-user", "ssr@example.ma", true, null), null));
        interceptor.preHandle(request, new MockHttpServletResponse(), handler);
        assertThat(service.windowCount()).isEqualTo(2);

        // An anonymous SSR-shaped read joins only the shared protective
        // ceiling: it creates no source-address or user-specific window.
        SecurityContextHolder.clearContext();
        interceptor.preHandle(request, new MockHttpServletResponse(), handler);
        assertThat(service.windowCount()).isEqualTo(2);
    }

    private static final class SignupEndpoint {
        @RateLimited(RateLimitType.SIGNUP)
        public void signup() {
        }
    }

    private static final class SearchEndpoint {
        @RateLimited(RateLimitType.SEARCH)
        public void search() {
        }
    }

    private static final class SsrReadEndpoint {
        @RateLimited(RateLimitType.SSR_READ)
        public void read() {
        }
    }
}
