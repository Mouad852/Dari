package ma.dari.api.config;

import io.micrometer.cloudwatch2.CloudWatchMeterRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.composite.CompositeMeterRegistry;
import ma.dari.api.support.AbstractIntegrationTest;
import ma.dari.api.support.AlarmMetricNames;
import ma.dari.api.support.CapturingCloudWatchClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.convention.TestBean;
import software.amazon.awssdk.services.cloudwatch.CloudWatchAsyncClient;
import software.amazon.awssdk.services.cloudwatch.model.MetricDatum;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The running application with the production metrics path switched on, and
 * CloudWatch replaced by an in-memory client: what would actually be sent.
 *
 * <p>{@code @AutoConfigureObservability} because Boot's test support otherwise
 * turns metrics export off, which removes the Prometheus registry; production
 * has both registries behind a composite, and so must this test.
 */
@AutoConfigureObservability(tracing = false)
@TestPropertySource(properties = {
        "dari.metrics.cloudwatch.enabled=true",
        "dari.metrics.cloudwatch.region=eu-west-3"
})
class CloudWatchMetricsApiTest extends AbstractIntegrationTest {

    static final CapturingCloudWatchClient CLOUDWATCH = new CapturingCloudWatchClient();

    @TestBean(name = "dariCloudWatchClient", methodName = "capturingClient")
    CloudWatchAsyncClient client;

    static CloudWatchAsyncClient capturingClient() {
        return CLOUDWATCH;
    }

    @Autowired
    CloudWatchMeterRegistry cloudWatch;

    @Autowired
    MeterRegistry primary;

    @Test
    @DisplayName("Exactly the five alarm metrics are published, under the names and dimensions the alarms use")
    void publishesExactlyTheAlarmMetrics() {
        cloudWatch.close();   // one final publish, on this thread

        assertThat(CLOUDWATCH.requests()).allSatisfy(request ->
                assertThat(request.namespace()).isEqualTo(AlarmMetricNames.NAMESPACE));
        assertThat(CLOUDWATCH.published()).containsExactlyInAnyOrderElementsOf(AlarmMetricNames.fromAllowList());

        MetricDatum database = CLOUDWATCH.datums().stream()
                .filter(datum -> datum.metricName().equals("dari.database.reachable.value"))
                .reduce((first, last) -> last).orElseThrow();
        assertThat(database.value()).as("database reachable").isEqualTo(1.0);
        assertThat(database.storageResolution()).as("standard resolution").isEqualTo(60);

        // The filter belongs to the CloudWatch registry alone: everything else
        // is still recorded for the ADMIN-only actuator.
        assertThat(primary).isInstanceOf(CompositeMeterRegistry.class);
        assertThat(primary.find("jvm.memory.used").meters()).isNotEmpty();
        assertThat(primary.find("dari.moderation.queue_depth").meters()).hasSize(2);
        assertThat(primary.find("dari.notifications.outbox_depth").meters()).hasSize(4);
    }
}
