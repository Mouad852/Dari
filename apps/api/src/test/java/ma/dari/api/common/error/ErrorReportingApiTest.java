package ma.dari.api.common.error;

import com.fasterxml.jackson.databind.JsonNode;
import com.google.firebase.auth.FirebaseToken;
import io.restassured.response.Response;
import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.support.FakeSentry;
import ma.dari.api.user.User;
import ma.dari.api.user.UserRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;

/**
 * Error tracking end to end: a real request through the security chain and the
 * catch-all, the real SDK, and a local fake ingest endpoint that records the
 * serialized envelope. Nothing here reaches the vendor.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ErrorReportingApiTest extends AbstractIntegrationTest {

    static final FakeSentry SENTRY = new FakeSentry();

    // Personal data planted in every part of the failing request.
    static final String BEARER = "secret-bearer-token-6f1c0d";
    static final String COOKIE = "secret-cookie-value-9a2e7b";
    static final String EMAIL = "amina.bennani@example.com";
    static final String PHONE = "+212612345678";
    static final String LATITUDE = "33.971612";
    static final String LONGITUDE = "-6.849812";
    static final String MESSAGE_BODY = "Salut, voici mon adresse: 12 rue des Oudayas";

    @DynamicPropertySource
    static void errorTracking(DynamicPropertyRegistry registry) {
        registry.add("dari.error-reporting.sentry-dsn", SENTRY::dsn);
        registry.add("dari.error-reporting.environment", () -> "integration-test");
    }

    @AfterAll
    static void stopFakeSentry() {
        SENTRY.close();
    }

    @Autowired
    UserRepository users;

    @BeforeEach
    void signedInUser() throws Exception {
        SENTRY.reset();
        String uid = "error-reporting-user";
        if (users.findByFirebaseUid(uid).isEmpty()) {
            users.save(new User(uid, EMAIL, true, "Amina"));
        }
        FirebaseToken token = Mockito.mock(FirebaseToken.class);
        Mockito.when(token.getUid()).thenReturn(uid);
        Mockito.when(token.getEmail()).thenReturn(EMAIL);
        Mockito.when(token.isEmailVerified()).thenReturn(true);
        Mockito.when(firebaseAuth.verifyIdToken(BEARER)).thenReturn(token);
    }

    @Test
    @Order(1)
    @DisplayName("An unhandled error reaches error tracking tagged and scrubbed")
    void unhandledErrorIsReportedScrubbed() throws Exception {
        String listingId = UUID.randomUUID().toString();
        Response response = explode(listingId, "corr-scrub-1");
        response.then()
                .statusCode(500)
                .body("code", equalTo("INTERNAL_ERROR"))
                .body("message", equalTo("Une erreur est survenue"));
        String correlationId = response.header("X-Correlation-Id");
        assertThat(correlationId).isEqualTo("corr-scrub-1");

        String envelope = SENTRY.awaitEnvelope(
                event -> correlationId.equals(event.path("tags").path("correlation_id").asText()),
                Duration.ofSeconds(10)).orElseThrow(() -> new AssertionError("no event received"));
        System.out.println("=== Scrubbed error-tracking envelope as received by the fake endpoint ===");
        System.out.println(envelope);
        JsonNode event = FakeSentry.eventIn(envelope);

        assertThat(event.path("level").asText()).isEqualTo("error");
        assertThat(event.path("release").asText()).isEqualTo("test-release-4b1d");
        assertThat(event.path("environment").asText()).isEqualTo("integration-test");
        assertThat(event.path("tags").path("route").asText()).isEqualTo("/api/v1/test-only/explode/{listingId}");
        assertThat(event.path("tags").path("http_method").asText()).isEqualTo("POST");
        assertThat(fieldNames(event.path("tags"))).containsExactlyInAnyOrder("route", "http_method", "correlation_id");

        JsonNode exceptions = event.path("exception").path("values");
        List<String> types = new ArrayList<>();
        exceptions.forEach(exception -> {
            types.add(exception.path("module").asText() + "." + exception.path("type").asText());
            assertThat(exception.has("value")).as("exception message dropped").isFalse();
            assertThat(exception.path("stacktrace").path("frames").size()).isPositive();
        });
        assertThat(types).containsExactlyInAnyOrder("java.lang.IllegalStateException", "java.lang.RuntimeException");

        for (String absent : new String[] {"request", "user", "breadcrumbs", "extra", "server_name", "message",
                "logentry", "threads", "modules"}) {
            assertThat(event.has(absent)).as("event has no %s", absent).isFalse();
        }
        // Header names appear legitimately in stack frames (Spring Security's
        // AuthorizationFilter); what must never appear is a header object or a value.
        assertThat(envelope).doesNotContain("\"headers\"", "\"cookies\"", "\"query_string\"");
        for (String secret : new String[] {BEARER, COOKIE, EMAIL, "example.com", PHONE, "212612345678",
                LATITUDE, LONGITUDE, "Oudayas", "email=", listingId, "secret-"}) {
            assertThat(envelope).as("envelope must not contain %s", secret).doesNotContain(secret);
        }
    }

    @Test
    @Order(2)
    @DisplayName("Expected 4xx responses are not reported")
    void expectedClientErrorsAreNotReported() throws Exception {
        given().header("X-Correlation-Id", "corr-404")
                .when().get("/listings/" + UUID.randomUUID())
                .then().statusCode(404);
        given().header("Authorization", "Bearer " + BEARER).header("X-Correlation-Id", "corr-400")
                .contentType("application/json").body("{\"listingId\":\"not-a-uuid\"")
                .when().post("/reports")
                .then().statusCode(400);

        // One sender drains one queue in order: once this 500 has arrived,
        // anything queued before it would have arrived too.
        explode(UUID.randomUUID().toString(), "corr-after-4xx").then().statusCode(500);
        assertThat(SENTRY.awaitEnvelope(
                event -> "corr-after-4xx".equals(event.path("tags").path("correlation_id").asText()),
                Duration.ofSeconds(10))).isPresent();
        assertThat(SENTRY.events()).extracting(event -> event.path("tags").path("correlation_id").asText())
                .doesNotContain("corr-404", "corr-400");
    }

    @Test
    @Order(3)
    @DisplayName("A failing error-tracking endpoint does not change the response")
    void failingEndpointDoesNotChangeTheResponse() throws Exception {
        SENTRY.mode(FakeSentry.Mode.FAIL);
        for (int i = 0; i < 5; i++) {
            explode(UUID.randomUUID().toString(), "corr-fail-" + i).then()
                    .statusCode(500)
                    .body("code", equalTo("INTERNAL_ERROR"))
                    .body("message", equalTo("Une erreur est survenue"));
        }
        assertThat(SENTRY.awaitEnvelope(event -> true, Duration.ofSeconds(10)))
                .as("the endpoint was reached and answered 500").isPresent();
    }

    @Test
    @Order(4)
    @DisplayName("A stalled error-tracking endpoint neither delays nor changes responses")
    void stalledEndpointDoesNotBlockRequests() throws Exception {
        SENTRY.mode(FakeSentry.Mode.STALL);
        long slowest = 0;
        // More failures than the SDK queue holds, so overflow is exercised too.
        for (int i = 0; i < SentryErrorReporter.MAX_QUEUE_SIZE + 20; i++) {
            long started = System.nanoTime();
            explode(UUID.randomUUID().toString(), "corr-stall-" + i).then()
                    .statusCode(500)
                    .body("code", equalTo("INTERNAL_ERROR"));
            slowest = Math.max(slowest, Duration.ofNanos(System.nanoTime() - started).toMillis());
        }
        assertThat(SENTRY.stalledRequests()).as("the sender is stuck on the endpoint").isPositive();
        // The SDK's own read timeout is 2 s; a request waiting on it would show.
        assertThat(slowest).as("slowest request, ms").isLessThan(1_000);
        SENTRY.mode(FakeSentry.Mode.ACCEPT);
    }

    private static Response explode(String listingId, String correlationId) {
        return given()
                .header("Authorization", "Bearer " + BEARER)
                .header("Cookie", "session=" + COOKIE)
                .header("X-Correlation-Id", correlationId)
                .queryParam("email", EMAIL)
                .queryParam("phone", PHONE)
                .contentType("application/json")
                .body(Map.of("body", MESSAGE_BODY, "latitude", LATITUDE, "longitude", LONGITUDE))
                .when().post("/test-only/explode/" + listingId);
    }

    private static List<String> fieldNames(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class ExplodingEndpointConfig {
        @Bean
        ExplodingController explodingController() {
            return new ExplodingController();
        }
    }

    /** Fails the way real code does: personal data in the message and in the cause. */
    @RestController
    static class ExplodingController {
        @PostMapping("/api/v1/test-only/explode/{listingId}")
        void explode(@PathVariable String listingId, @RequestParam String email, @RequestParam String phone,
                     @RequestBody Map<String, String> body) {
            throw new IllegalStateException("Could not save message for " + email + " (" + phone + ") at "
                    + body.get("latitude") + "," + body.get("longitude") + " on listing " + listingId
                    + ": " + body.get("body"),
                    new RuntimeException("duplicate key (email)=(" + email + ")"));
        }
    }
}
