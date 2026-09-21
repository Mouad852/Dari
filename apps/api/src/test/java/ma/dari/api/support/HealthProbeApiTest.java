package ma.dari.api.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.HealthEndpointGroups;

import static io.restassured.RestAssured.given;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

class HealthProbeApiTest extends AbstractIntegrationTest {

    @Autowired
    HealthEndpointGroups groups;

    @Test
    @DisplayName("Liveness and readiness answer an unauthenticated platform probe without details")
    void probesArePublicAndTerse() {
        for (String probe : new String[] {"/actuator/health/liveness", "/actuator/health/readiness"}) {
            given().basePath("")
                    .when().get(probe)
                    .then()
                    .statusCode(200)
                    .body("status", equalTo("UP"))
                    .body("components", nullValue());
        }
    }

    @Test
    @DisplayName("Readiness depends on the database; liveness does not")
    void onlyReadinessIncludesTheDatabase() {
        assertThat(groups.get("readiness").isMember("db")).isTrue();
        assertThat(groups.get("readiness").isMember("readinessState")).isTrue();
        assertThat(groups.get("liveness").isMember("db")).isFalse();
        assertThat(groups.get("liveness").isMember("livenessState")).isTrue();
    }

    @Test
    @DisplayName("Opening the probes does not open component health or metrics")
    void otherActuatorPathsStayClosed() {
        given().basePath("").when().get("/actuator/health/db").then().statusCode(401);
        given().basePath("").when().get("/actuator/metrics").then().statusCode(401);
        given().basePath("").when().get("/actuator/prometheus").then().statusCode(401);
    }
}
