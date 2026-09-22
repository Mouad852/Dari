package ma.dari.api.config;

import io.micrometer.cloudwatch2.CloudWatchConfig;
import io.micrometer.cloudwatch2.CloudWatchMeterRegistry;
import io.micrometer.core.instrument.Clock;
import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.Tag;
import io.micrometer.core.instrument.config.MeterFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.cloudwatch.CloudWatchAsyncClient;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Pushes the metrics the production alarms need to CloudWatch, and nothing else.
 *
 * <p>Push rather than scrape: on ECS Fargate behind an ALB nothing can reach
 * {@code /actuator/prometheus} without a Firebase admin token, and a push needs
 * no open port, only the task role's {@code cloudwatch:PutMetricData}. The
 * credentials come from the SDK's default chain, which on Fargate is the task
 * role; the region from {@code DARI_METRICS_CLOUDWATCH_REGION}, else the
 * {@code AWS_REGION} Fargate sets on every task.
 *
 * <p>{@link #ALARM_METRICS} is an allow-list with exact tags. Every other meter
 * (JVM, HTTP, Hikari, the other domain meters) stays in the Prometheus registry
 * behind the ADMIN-only actuator and costs nothing in CloudWatch, where each
 * name-plus-dimensions combination is a billed custom metric. Tags are fixed,
 * low-cardinality enum values; no task id, URI or user ever becomes a dimension.
 *
 * <p>The filter is set on this registry only. Boot then puts it and the
 * Prometheus registry behind a composite, so the application and the actuator
 * still see every meter; disabling Prometheus export would leave this filtered
 * registry as the only one, so keep it enabled.
 *
 * <p>Failures stay on the registry's own publishing thread: an unreachable
 * endpoint or missing credentials is logged each step and the request path
 * never notices. Off in development and tests; production turns it on.
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "dari.metrics.cloudwatch.enabled", havingValue = "true")
public class CloudWatchMetricsConfig {

    private static final Logger log = LoggerFactory.getLogger(CloudWatchMetricsConfig.class);

    /** One allowed meter: its name and its complete tag set. */
    public record AlarmMetric(String name, Map<String, String> tags) {
        boolean matches(Meter.Id id) {
            return id.getName().equals(name) && tagsOf(id).equals(tags);
        }

        private static Map<String, String> tagsOf(Meter.Id id) {
            return id.getTags().stream().collect(Collectors.toMap(Tag::getKey, Tag::getValue));
        }
    }

    /**
     * Exactly what the alarms in infra/aws/alarms read. Gauges publish as
     * {@code <name>.value} with their tags as dimensions; AlarmDefinitionsTest
     * fails if an alarm names anything not produced from this list.
     */
    public static final List<AlarmMetric> ALARM_METRICS = List.of(
            new AlarmMetric("dari.database.reachable", Map.of()),
            new AlarmMetric("dari.notifications.outbox_depth", Map.of("status", "PENDING")),
            new AlarmMetric("dari.notifications.outbox_depth", Map.of("status", "DEAD")),
            new AlarmMetric("dari.media.cleanup_failures", Map.of()),
            new AlarmMetric("dari.media.cleanup_depth", Map.of("status", "DEAD")));

    static final Duration API_CALL_TIMEOUT = Duration.ofSeconds(10);

    public static MeterFilter alarmMetricsOnly() {
        return MeterFilter.denyUnless(id -> ALARM_METRICS.stream().anyMatch(metric -> metric.matches(id)));
    }

    @Bean(destroyMethod = "close")
    CloudWatchAsyncClient dariCloudWatchClient(@Value("${dari.metrics.cloudwatch.region:}") String region,
                                               @Value("${dari.metrics.cloudwatch.endpoint:}") String endpoint) {
        return client(regionOrNull(region), endpoint, DefaultCredentialsProvider.builder().build());
    }

    @Bean
    CloudWatchMeterRegistry cloudWatchMeterRegistry(CloudWatchAsyncClient client,
                                                    @Value("${dari.metrics.cloudwatch.namespace}") String namespace,
                                                    @Value("${dari.metrics.cloudwatch.step}") Duration step,
                                                    @Value("${dari.metrics.cloudwatch.region:}") String region) {
        boolean publishing = regionOrNull(region) != null;
        if (!publishing) {
            log.warn("CloudWatch metrics are enabled but no region is set (DARI_METRICS_CLOUDWATCH_REGION "
                    + "or AWS_REGION): alarm metrics will not be published");
        } else {
            log.info("Publishing {} alarm metrics to CloudWatch namespace {} every {}",
                    ALARM_METRICS.size(), namespace, step);
        }
        return registry(client, namespace, step, publishing);
    }

    /** Package-visible so tests can point a real client at a dead local endpoint. */
    static CloudWatchAsyncClient client(Region region, String endpoint, AwsCredentialsProvider credentials) {
        var builder = CloudWatchAsyncClient.builder()
                // A client needs a region to be built; with none configured the
                // registry below never publishes, so this one is never used.
                .region(region != null ? region : Region.US_EAST_1)
                .credentialsProvider(credentials)
                .overrideConfiguration(override -> override
                        .apiCallTimeout(API_CALL_TIMEOUT)
                        .apiCallAttemptTimeout(Duration.ofSeconds(4)));
        if (endpoint != null && !endpoint.isBlank()) builder.endpointOverride(URI.create(endpoint.trim()));
        return builder.build();
    }

    static CloudWatchMeterRegistry registry(CloudWatchAsyncClient client, String namespace, Duration step,
                                            boolean publishing) {
        CloudWatchConfig config = new CloudWatchConfig() {
            @Override
            public String get(String key) {
                return null;
            }

            @Override
            public String namespace() {
                return namespace;
            }

            @Override
            public Duration step() {
                return step;
            }

            @Override
            public boolean enabled() {
                return publishing;
            }
        };
        CloudWatchMeterRegistry registry = new CloudWatchMeterRegistry(config, Clock.SYSTEM, client);
        // Before any meter exists; Boot binds its meters to the registry later.
        registry.config().meterFilter(alarmMetricsOnly());
        return registry;
    }

    private static Region regionOrNull(String region) {
        return region == null || region.isBlank() ? null : Region.of(region.trim());
    }
}
