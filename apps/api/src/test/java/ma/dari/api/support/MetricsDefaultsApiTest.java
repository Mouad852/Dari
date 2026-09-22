package ma.dari.api.support;

import io.micrometer.cloudwatch2.CloudWatchMeterRegistry;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import software.amazon.awssdk.services.cloudwatch.CloudWatchAsyncClient;

import static org.assertj.core.api.Assertions.assertThat;

class MetricsDefaultsApiTest extends AbstractIntegrationTest {

    @Autowired
    ApplicationContext context;

    @Autowired
    MeterRegistry registry;

    @Test
    @DisplayName("Without the production profile nothing is pushed to CloudWatch")
    void cloudWatchIsOffOutsideProduction() {
        // application-test.yml does not touch dari.metrics.cloudwatch, so this is
        // application.yml's default: the same one local development runs with.
        assertThat(context.getBeansOfType(CloudWatchMeterRegistry.class)).isEmpty();
        assertThat(context.getBeansOfType(CloudWatchAsyncClient.class)).isEmpty();
    }

    @Test
    @DisplayName("The database gauge reads the readiness check: 1 while the database answers")
    void databaseGaugeReadsTheReadinessCheck() {
        assertThat(registry.get("dari.database.reachable").gauge().value()).isEqualTo(1.0);
    }
}
