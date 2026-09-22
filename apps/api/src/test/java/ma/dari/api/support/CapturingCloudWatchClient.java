package ma.dari.api.support;

import software.amazon.awssdk.services.cloudwatch.CloudWatchAsyncClient;
import software.amazon.awssdk.services.cloudwatch.model.Dimension;
import software.amazon.awssdk.services.cloudwatch.model.MetricDatum;
import software.amazon.awssdk.services.cloudwatch.model.PutMetricDataRequest;
import software.amazon.awssdk.services.cloudwatch.model.PutMetricDataResponse;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

/**
 * Stands in for CloudWatch: accepts every PutMetricData call and keeps the
 * request. Nothing is sent anywhere.
 */
public final class CapturingCloudWatchClient implements CloudWatchAsyncClient {

    /** A published metric as an alarm would name it: namespace, metric name and dimensions. */
    public record PublishedMetric(String namespace, String name, Map<String, String> dimensions) {
    }

    private final List<PutMetricDataRequest> requests = new CopyOnWriteArrayList<>();

    @Override
    public CompletableFuture<PutMetricDataResponse> putMetricData(PutMetricDataRequest request) {
        requests.add(request);
        return CompletableFuture.completedFuture(PutMetricDataResponse.builder().build());
    }

    public List<PutMetricDataRequest> requests() {
        return List.copyOf(requests);
    }

    public List<MetricDatum> datums() {
        return requests.stream().flatMap(request -> request.metricData().stream()).toList();
    }

    public Set<PublishedMetric> published() {
        return requests.stream()
                .flatMap(request -> request.metricData().stream()
                        .map(datum -> new PublishedMetric(request.namespace(), datum.metricName(),
                                datum.dimensions().stream()
                                        .collect(Collectors.toMap(Dimension::name, Dimension::value)))))
                .collect(Collectors.toSet());
    }

    @Override
    public String serviceName() {
        return "cloudwatch";
    }

    @Override
    public void close() {
    }
}
