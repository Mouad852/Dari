package ma.dari.api.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;

class SecurityHeadersApiTest extends AbstractIntegrationTest {

    @Test
    @DisplayName("API responses include browser security headers")
    void apiResponsesIncludeSecurityHeaders() {
        given()
                .when().get("/listings")
                .then()
                .statusCode(200)
                .header("X-Content-Type-Options", equalTo("nosniff"))
                .header("X-Frame-Options", equalTo("DENY"))
                .header("Referrer-Policy", equalTo("strict-origin-when-cross-origin"))
                .header("Permissions-Policy", equalTo("camera=(), microphone=(), geolocation=()"));
    }

    @Test
    @DisplayName("CORS allows only the configured web origin and requested API headers")
    void corsAllowsConfiguredOriginOnly() {
        given()
                .header("Origin", "http://localhost:3000")
                .header("Access-Control-Request-Method", "GET")
                .header("Access-Control-Request-Headers", "Authorization, Content-Type")
                .when().options("/listings")
                .then()
                .statusCode(200)
                .header("Access-Control-Allow-Origin", equalTo("http://localhost:3000"))
                .header("Access-Control-Allow-Headers", equalTo("Authorization, Content-Type"));

        given()
                .header("Origin", "https://attacker.example")
                .header("Access-Control-Request-Method", "GET")
                .when().options("/listings")
                .then()
                .statusCode(403)
                .header("Access-Control-Allow-Origin", nullValue());
    }
}
