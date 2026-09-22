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
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service, SSR_SECRET);
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
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service, SSR_SECRET);
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
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service, SSR_SECRET);
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
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service, SSR_SECRET);
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
    void keyedRendersFromTheWebHostShareTheSsrCeilingInsteadOfItsSearchQuota() throws Exception {
        RateLimitService service = serviceWithSearchMax(120);
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service, SSR_SECRET);

        for (HandlerMethod handler : new HandlerMethod[] { ssrRead(), search() }) {
            for (int request = 0; request < 121; request++) {
                // One source address: every render comes from the Next.js host.
                MockHttpServletRequest rendered = keyed(request("10.0.0.5"), SSR_SECRET);
                assertThatCode(() -> interceptor.preHandle(rendered, new MockHttpServletResponse(), handler))
                        .doesNotThrowAnyException();
            }
        }
        assertThat(service.tracks(RateLimitType.SSR_READ, "shared:ssr-read")).isTrue();
        assertThat(service.tracks(RateLimitType.SEARCH, "ip:10.0.0.5")).isFalse();
        assertThat(service.tracks(RateLimitType.SSR_READ, "ip:10.0.0.5")).isFalse();
        assertThat(service.windowCount()).isEqualTo(1);
    }

    @Test
    void keyedSsrReadKeepsAnAuthenticatedUserDimensionAlongsideTheSharedCeiling() throws Exception {
        RateLimitService service = serviceWithSearchMax(120);
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service, SSR_SECRET);
        MockHttpServletRequest request = keyed(request("10.0.0.5"), SSR_SECRET);

        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser("uid-ssr-user", "ssr@example.ma", true, null), null));
        interceptor.preHandle(request, new MockHttpServletResponse(), ssrRead());
        assertThat(service.tracks(RateLimitType.SSR_READ, "user:uid-ssr-user")).isTrue();
        assertThat(service.windowCount()).isEqualTo(2);

        // An anonymous keyed read joins only the shared protective ceiling.
        SecurityContextHolder.clearContext();
        interceptor.preHandle(request, new MockHttpServletResponse(), ssrRead());
        assertThat(service.windowCount()).isEqualTo(2);
    }

    @Test
    void unkeyedSsrReadIsLimitedPerAddressAtTheSearchThreshold() throws Exception {
        RateLimitService service = serviceWithSearchMax(2);
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service, SSR_SECRET);

        interceptor.preHandle(request("192.0.2.30"), new MockHttpServletResponse(), ssrRead());
        interceptor.preHandle(request("192.0.2.30"), new MockHttpServletResponse(), ssrRead());
        assertThatThrownBy(() -> interceptor.preHandle(request("192.0.2.30"), new MockHttpServletResponse(), ssrRead()))
                .isInstanceOf(RateLimitExceededException.class);

        // Another address still has its own quota, and nothing touched the SSR ceiling.
        assertThatCode(() -> interceptor.preHandle(request("192.0.2.31"), new MockHttpServletResponse(), ssrRead()))
                .doesNotThrowAnyException();
        assertThat(service.tracks(RateLimitType.SEARCH, "ip:192.0.2.30")).isTrue();
        assertThat(service.tracks(RateLimitType.SSR_READ, "shared:ssr-read")).isFalse();
    }

    @Test
    void aWrongOrPartialKeyIsTreatedExactlyLikeNoKey() throws Exception {
        for (String wrong : new String[] { "wrong", SSR_SECRET.substring(0, 20), SSR_SECRET + "x", "" }) {
            RateLimitService service = serviceWithSearchMax(1);
            RateLimitInterceptor interceptor = new RateLimitInterceptor(service, SSR_SECRET);

            interceptor.preHandle(keyed(request("192.0.2.40"), wrong), new MockHttpServletResponse(), ssrRead());
            assertThatThrownBy(() -> interceptor.preHandle(keyed(request("192.0.2.40"), wrong), new MockHttpServletResponse(), ssrRead()))
                    .isInstanceOf(RateLimitExceededException.class);
            assertThat(service.tracks(RateLimitType.SSR_READ, "shared:ssr-read")).isFalse();
        }
    }

    @Test
    void anUnconfiguredSecretTrustsNoRequestEvenWithAnEmptyHeader() throws Exception {
        RateLimitService service = serviceWithSearchMax(1);
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service, "");

        interceptor.preHandle(keyed(request("192.0.2.50"), ""), new MockHttpServletResponse(), ssrRead());
        assertThatThrownBy(() -> interceptor.preHandle(keyed(request("192.0.2.50"), ""), new MockHttpServletResponse(), ssrRead()))
                .isInstanceOf(RateLimitExceededException.class);
        assertThat(service.tracks(RateLimitType.SSR_READ, "shared:ssr-read")).isFalse();
    }

    @Test
    void mutationPoliciesIgnoreTheSsrKey() throws Exception {
        // signup.max = 1: a valid key must not move SIGNUP onto the SSR ceiling.
        RateLimitService service = new RateLimitService(
                1, Duration.ofHours(1), 1, Duration.ofMinutes(1), 1, Duration.ofHours(1),
                1, Duration.ofHours(1), 1, Duration.ofHours(1), 120, Duration.ofMinutes(1));
        RateLimitInterceptor interceptor = new RateLimitInterceptor(service, SSR_SECRET);
        HandlerMethod signup = new HandlerMethod(new SignupEndpoint(), SignupEndpoint.class.getMethod("signup"));

        interceptor.preHandle(keyed(request("192.0.2.60"), SSR_SECRET), new MockHttpServletResponse(), signup);
        assertThatThrownBy(() -> interceptor.preHandle(keyed(request("192.0.2.60"), SSR_SECRET), new MockHttpServletResponse(), signup))
                .isInstanceOf(RateLimitExceededException.class);
        assertThat(service.tracks(RateLimitType.SIGNUP, "ip:192.0.2.60")).isTrue();
        assertThat(service.tracks(RateLimitType.SSR_READ, "shared:ssr-read")).isFalse();
    }

    private static final String SSR_SECRET = "test-only-ssr-shared-secret-with-at-least-32-characters";

    private static RateLimitService serviceWithSearchMax(int searchMax) {
        return new RateLimitService(
                5, Duration.ofHours(1), 30, Duration.ofMinutes(1), 5, Duration.ofHours(1),
                20, Duration.ofHours(1), 5, Duration.ofHours(1), searchMax, Duration.ofMinutes(1));
    }

    private static MockHttpServletRequest request(String remoteAddress) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddress);
        return request;
    }

    private static MockHttpServletRequest keyed(MockHttpServletRequest request, String key) {
        request.addHeader(RateLimitInterceptor.SSR_KEY_HEADER, key);
        return request;
    }

    private static HandlerMethod ssrRead() throws NoSuchMethodException {
        return new HandlerMethod(new SsrReadEndpoint(), SsrReadEndpoint.class.getMethod("read"));
    }

    private static HandlerMethod search() throws NoSuchMethodException {
        return new HandlerMethod(new SearchEndpoint(), SearchEndpoint.class.getMethod("search"));
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
