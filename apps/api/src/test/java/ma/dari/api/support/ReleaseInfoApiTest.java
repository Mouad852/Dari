package ma.dari.api.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

class ReleaseInfoApiTest extends AbstractIntegrationTest {

    @Test
    @DisplayName("/actuator/info shows the configured release version without a token")
    void infoShowsTheConfiguredReleaseVersion() {
        // application-test.yml sets dari.release-version, as DARI_RELEASE_VERSION would.
        given().basePath("")
                .when().get("/actuator/info")
                .then()
                .statusCode(200)
                .body("release.version", equalTo("test-release-4b1d"));
    }
}
