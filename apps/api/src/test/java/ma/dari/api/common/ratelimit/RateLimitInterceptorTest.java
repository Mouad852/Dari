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
}
