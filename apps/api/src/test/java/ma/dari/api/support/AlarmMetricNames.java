package ma.dari.api.support;

import ma.dari.api.config.CloudWatchMetricsConfig;
import ma.dari.api.support.CapturingCloudWatchClient.PublishedMetric;

import java.util.Set;
import java.util.stream.Collectors;

/**
 * The CloudWatch metrics the allow-list produces, as an alarm must name them.
 * CloudWatchMetricsApiTest proves the running application publishes exactly
 * this set; AlarmDefinitionsTest proves every alarm stays inside it.
 */
public final class AlarmMetricNames {

    public static final String NAMESPACE = "Dari/Api";

    private AlarmMetricNames() {
    }

    /** Micrometer's CloudWatch registry publishes a gauge as {@code <name>.value}, tags as dimensions. */
    public static Set<PublishedMetric> fromAllowList() {
        return CloudWatchMetricsConfig.ALARM_METRICS.stream()
                .map(metric -> new PublishedMetric(NAMESPACE, metric.name() + ".value", metric.tags()))
                .collect(Collectors.toSet());
    }
}
