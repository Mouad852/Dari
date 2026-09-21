package ma.dari.api.common.ratelimit;

import io.restassured.RestAssured;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import ma.dari.api.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;

import java.io.IOException;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * MockMvc cannot exercise Tomcat's RemoteIpValve. These requests go through a
 * random-port Tomcat instance whose only trusted TCP peer is the test client.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "server.forward-headers-strategy=native",
        "server.tomcat.remoteip.internal-proxies=127\\.0\\.0\\.1|0:0:0:0:0:0:0:1",
        "dari.rate-limits.search.max=2",
        "dari.rate-limits.search.window=PT1H",
        "dari.rate-limits.max-tracked-keys=2"
})
@Import(TomcatForwardedRateLimitIntegrationTest.ForwardedRequestProbeConfiguration.class)
class TomcatForwardedRateLimitIntegrationTest extends AbstractIntegrationTest {

    @org.springframework.beans.factory.annotation.Autowired
    private RateLimitService rateLimits;

    @Test
    void rightmostAlbAppendedAddressControlsBucketsAndOriginalHttpsState() {
        responseFor("198.51.100.10, 203.0.113.9")
                .statusCode(200)
                .header("X-Test-Remote-Addr", "203.0.113.9")
                .header("X-Test-Scheme", "https")
                .header("X-Test-Secure", "true")
                .header("Strict-Transport-Security", org.hamcrest.Matchers.containsString("max-age=31536000"));
        responseFor("198.51.100.11, 203.0.113.9").statusCode(200);
        responseFor("198.51.100.12, 203.0.113.9").statusCode(429);

        // This client has a different rightmost entry, so it gets a separate
        // bucket even after the first client's bucket is exhausted.
        responseFor("198.51.100.13, 203.0.113.10").statusCode(200);
        responseFor("198.51.100.14, 203.0.113.10").statusCode(200);
        responseFor("198.51.100.15, 203.0.113.10").statusCode(429);

        // The tracked map is full. These distinct sources share the bounded
        // overflow bucket rather than creating keys from attacker input.
        responseFor("198.51.100.16, 203.0.113.11").statusCode(200);
        responseFor("198.51.100.17, 203.0.113.12").statusCode(200);
        responseFor("198.51.100.18, 203.0.113.13").statusCode(429);
        assertThat(rateLimits.windowCount()).isEqualTo(2);
        assertThat(rateLimits.trackedKeyCapHitCount()).isEqualTo(3);
    }

    private io.restassured.response.ValidatableResponse responseFor(String forwardedFor) {
        return given()
                .header("X-Forwarded-For", forwardedFor)
                .header("X-Forwarded-Proto", "https")
                .get("/listings?city=Rabat")
                .then();
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class ForwardedRequestProbeConfiguration {
        @Bean
        FilterRegistrationBean<Filter> forwardedRequestProbe() {
            FilterRegistrationBean<Filter> registration = new FilterRegistrationBean<>();
            registration.setFilter(new ForwardedRequestProbeFilter());
            registration.setOrder(Integer.MIN_VALUE);
            return registration;
        }
    }

    private static final class ForwardedRequestProbeFilter implements Filter {
        @Override
        public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                throws IOException, ServletException {
            HttpServletRequest httpRequest = (HttpServletRequest) request;
            HttpServletResponse httpResponse = (HttpServletResponse) response;
            httpResponse.setHeader("X-Test-Remote-Addr", httpRequest.getRemoteAddr());
            httpResponse.setHeader("X-Test-Scheme", httpRequest.getScheme());
            httpResponse.setHeader("X-Test-Secure", Boolean.toString(httpRequest.isSecure()));
            chain.doFilter(request, response);
        }
    }
}
