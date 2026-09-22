package ma.dari.api.common.ratelimit;

import com.google.firebase.auth.FirebaseToken;
import io.restassured.http.ContentType;
import io.restassured.response.ValidatableResponse;
import io.restassured.specification.RequestSpecification;
import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;

/**
 * The web runtime's server-only key, end to end through real Tomcat. Each test
 * is its own client address: the only trusted TCP peer is the test client, so
 * X-Forwarded-For selects the address the limiter sees (as behind the ALB).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "server.forward-headers-strategy=native",
        "server.tomcat.remoteip.internal-proxies=127\\.0\\.0\\.1|0:0:0:0:0:0:0:1",
        "dari.rate-limits.search.max=3",
        "dari.rate-limits.search.window=PT1H",
        "dari.rate-limits.ssr-read.max=50",
        "dari.rate-limits.ssr-read.window=PT1H",
        "dari.rate-limits.signup.max=2",
        "dari.rate-limits.signup.window=PT1H"
})
class SsrSharedSecretRateLimitIntegrationTest extends AbstractIntegrationTest {

    /** application-test.yml's dari.ssr.shared-secret. */
    private static final String SSR_KEY = "test-only-ssr-shared-secret-with-at-least-32-characters";

    @Autowired
    private RateLimitService rateLimits;

    @Autowired
    private UserRepository users;

    private String profilePath;

    @BeforeEach
    void createPublicProfile() {
        String unique = UUID.randomUUID().toString();
        User owner = users.save(new User("uid-ssr-" + unique, unique + "@example.invalid", true, "Profil public"));
        profilePath = "/users/" + owner.getId();
    }

    @Test
    void unkeyedOrWrongKeyReadsOfAnSsrEndpointAreLimitedPerAddressAtTheSearchThreshold() {
        for (int request = 1; request <= 3; request++) {
            read("203.0.113.21", null).statusCode(200);
            read("203.0.113.22", "not-the-ssr-key").statusCode(200);
        }
        read("203.0.113.21", null).statusCode(429);
        read("203.0.113.22", "not-the-ssr-key").statusCode(429);

        assertThat(rateLimits.tracks(RateLimitType.SEARCH, "ip:203.0.113.21")).isTrue();
        assertThat(rateLimits.tracks(RateLimitType.SEARCH, "ip:203.0.113.22")).isTrue();
    }

    @Test
    void anAttackerWhoExhaustsTheirQuotaCannotBurnTheSsrBudget() {
        int firstLimited = 0;
        for (int request = 1; request <= 20 && firstLimited == 0; request++) {
            if (read("203.0.113.23", null).extract().statusCode() == 429) firstLimited = request;
        }
        assertThat(firstLimited).isEqualTo(4);

        // The attacker's 20 attempts spent only their own per-address quota:
        // the web runtime's keyed renders still succeed, from any address.
        read("203.0.113.23", SSR_KEY).statusCode(200);
        read("10.0.20.7", SSR_KEY).statusCode(200);
    }

    @Test
    void keyedReadsDrawOnTheSharedBucketAndNeverOnThePerAddressOne() {
        // Past the search threshold of 3, from one address, on an SSR_READ and
        // a SEARCH endpoint alike.
        for (int request = 1; request <= 5; request++) {
            read("203.0.113.31", SSR_KEY).statusCode(200);
            keyed(SSR_KEY, "203.0.113.31").get("/listings?city=Rabat").then().statusCode(200);
        }
        assertThat(rateLimits.tracks(RateLimitType.SSR_READ, "shared:ssr-read")).isTrue();
        assertThat(rateLimits.tracks(RateLimitType.SEARCH, "ip:203.0.113.31")).isFalse();
        assertThat(rateLimits.tracks(RateLimitType.SSR_READ, "ip:203.0.113.31")).isFalse();

        // The same address without the key still has its full untouched quota.
        for (int request = 1; request <= 3; request++) {
            read("203.0.113.31", null).statusCode(200);
        }
        read("203.0.113.31", null).statusCode(429);
    }

    @Test
    void mutationEndpointsIgnoreTheSsrKey() throws Exception {
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn("uid-ssr-signup-" + UUID.randomUUID());
        Mockito.when(token.getEmail()).thenReturn("ssr.signup@example.invalid");
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(Mockito.anyString())).thenReturn(token);

        // signup.max = 2. The body is irrelevant: the limiter runs first.
        for (int request = 1; request <= 2; request++) {
            signup().then().statusCode(not(429));
        }
        signup().then().statusCode(429)
                .body(not(containsString(SSR_KEY)))
                .header("Retry-After", org.hamcrest.Matchers.notNullValue());
        assertThat(rateLimits.tracks(RateLimitType.SIGNUP, "ip:203.0.113.41")).isTrue();
    }

    private io.restassured.response.Response signup() {
        return keyed(SSR_KEY, "203.0.113.41")
                .header("Authorization", "Bearer signup-token")
                .contentType(ContentType.JSON)
                .body("{}")
                .post("/users");
    }

    private ValidatableResponse read(String clientAddress, String key) {
        return keyed(key, clientAddress).get(profilePath).then();
    }

    private static RequestSpecification keyed(String key, String clientAddress) {
        RequestSpecification request = given().header("X-Forwarded-For", clientAddress);
        return key == null ? request : request.header(RateLimitInterceptor.SSR_KEY_HEADER, key);
    }
}
