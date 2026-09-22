package ma.dari.api.config;

import io.micrometer.cloudwatch2.CloudWatchMeterRegistry;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.Timer;
import ma.dari.api.support.CapturingCloudWatchClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.cloudwatch.CloudWatchAsyncClient;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.time.Duration;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * The CloudWatch registry in isolation. No test here can reach AWS: clients
 * either capture in memory or point at a closed local port with placeholder
 * credentials.
 */
class CloudWatchMetricsConfigTest {

    @Test
    @DisplayName("The allow-list keeps exactly the five alarm meters and drops everything else")
    void allowListKeepsExactlyTheAlarmMeters() {
        CloudWatchMeterRegistry registry = CloudWatchMetricsConfig.registry(
                new CapturingCloudWatchClient(), "Dari/Api", Duration.ofMinutes(1), false);
        try {
            // Intended.
            Gauge.builder("dari.database.reachable", () -> 1).register(registry);
            for (String status : new String[] {"PENDING", "SENDING", "SENT", "DEAD"}) {
                Gauge.builder("dari.notifications.outbox_depth", () -> 0).tag("status", status).register(registry);
            }
            Gauge.builder("dari.media.cleanup_failures", () -> 0).register(registry);
            Gauge.builder("dari.media.cleanup_depth", () -> 0).tag("status", "PENDING").register(registry);
            Gauge.builder("dari.media.cleanup_depth", () -> 0).tag("status", "DEAD").register(registry);
            // Decoys: other names, and allowed names with extra or different tags.
            Gauge.builder("dari.database.reachable", () -> 1).tag("task", "abc123").register(registry);
            Gauge.builder("dari.moderation.queue_depth", () -> 3).tag("target", "listing").register(registry);
            Counter.builder("dari.errors.unhandled").tag("exception", "IllegalStateException").register(registry);
            Timer.builder("http.server.requests").tag("uri", "/api/v1/listings/{id}").tag("status", "500")
                    .register(registry);
            Gauge.builder("jvm.memory.used", () -> 1).tag("area", "heap").register(registry);
            Counter.builder("hikaricp.connections.timeout").tag("pool", "dari-pool").register(registry);
            Timer.builder("dari.search.latency").register(registry);

            Set<String> kept = registry.getMeters().stream().map(CloudWatchMetricsConfigTest::describe)
                    .collect(Collectors.toSet());
            assertThat(kept).containsExactlyInAnyOrder(
                    "dari.database.reachable{}",
                    "dari.notifications.outbox_depth{status=PENDING}",
                    "dari.notifications.outbox_depth{status=DEAD}",
                    "dari.media.cleanup_failures{}",
                    "dari.media.cleanup_depth{status=DEAD}");
            assertThat(kept).hasSameSizeAs(CloudWatchMetricsConfig.ALARM_METRICS);
        } finally {
            registry.close();
        }
    }

    @Test
    @DisplayName("An unreachable CloudWatch endpoint fails the push quietly and within its timeout")
    void unreachableEndpointDoesNotThrow() throws IOException {
        assertPushFailsQuietly(StaticCredentialsProvider.create(
                AwsBasicCredentials.create("test-only-access-key", "test-only-secret-key")));
    }

    @Test
    @DisplayName("Missing credentials fail the push quietly")
    void missingCredentialsDoNotThrow() throws IOException {
        AwsCredentialsProvider none = () -> {
            throw SdkClientException.create("Unable to load credentials from any of the providers in the chain");
        };
        assertPushFailsQuietly(none);
    }

    private static void assertPushFailsQuietly(AwsCredentialsProvider credentials) throws IOException {
        CloudWatchAsyncClient client = CloudWatchMetricsConfig.client(
                Region.EU_WEST_3, "http://127.0.0.1:" + closedPort(), credentials);
        CloudWatchMeterRegistry registry = CloudWatchMetricsConfig.registry(
                client, "Dari/Api", Duration.ofMinutes(1), true);
        Gauge.builder("dari.database.reachable", () -> 1).register(registry);

        long started = System.nanoTime();
        // close() runs one final publish on this thread: the worst case a
        // shutdown can see.
        assertThatCode(registry::close).doesNotThrowAnyException();
        long elapsed = Duration.ofNanos(System.nanoTime() - started).toMillis();
        client.close();

        assertThat(elapsed).as("final publish, ms")
                .isLessThan(CloudWatchMetricsConfig.API_CALL_TIMEOUT.toMillis() + 2_000);
    }

    private static int closedPort() throws IOException {
        try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            return socket.getLocalPort();
        }
    }

    private static String describe(Meter meter) {
        Meter.Id id = meter.getId();
        return id.getName() + id.getTags().stream().map(tag -> tag.getKey() + "=" + tag.getValue())
                .collect(Collectors.joining(",", "{", "}"));
    }
}
