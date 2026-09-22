package ma.dari.api.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ma.dari.api.support.CapturingCloudWatchClient.PublishedMetric;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The reviewable alarm definitions in infra/aws/alarms, checked without AWS.
 *
 * <ul>
 *   <li>Each file, rendered with placeholder values, is valid input for
 *       {@code aws cloudwatch put-metric-alarm --cli-input-json}: known
 *       parameters only, with the types, enums and limits of the PutMetricAlarm
 *       API reference.</li>
 *   <li>Every metric in the application's namespace is one the CloudWatch
 *       allow-list publishes, with exactly its dimensions; and every published
 *       metric is read by some alarm (no metric paid for and unused).
 *       CloudWatchMetricsApiTest proves the running application publishes
 *       exactly {@link AlarmMetricNames#fromAllowList()}.</li>
 *   <li>The placeholders the files use are exactly the ones apply-alarms.sh
 *       renders.</li>
 * </ul>
 */
class AlarmDefinitionsTest {

    private static final Path ALARMS = Path.of("..", "..", "infra", "aws", "alarms");
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern PLACEHOLDER = Pattern.compile("__[A-Z0-9_]+__");

    /** Example values for rendering only: obviously fake, never real resources. */
    private static final Map<String, String> EXAMPLES = Map.of(
            "__SNS_TOPIC_ARN__", "arn:aws:sns:eu-west-3:000000000000:dari-alarms-example",
            "__SNS_TOPIC_ARN_US_EAST_1__", "arn:aws:sns:us-east-1:000000000000:dari-alarms-example",
            "__API_HEALTH_CHECK_ID__", "00000000-0000-4000-8000-000000000000",
            "__ALB_ARN_SUFFIX__", "app/dari-api-example/0123456789abcdef",
            "__BACKUP_VAULT_NAME__", "dari-example-vault",
            "__FIVE_XX_RATE_PERCENT__", "5",
            "__FIVE_XX_MIN_REQUESTS__", "20");

    private static final Set<String> AWS_NAMESPACES = Set.of("AWS/Route53", "AWS/ApplicationELB", "AWS/Backup");

    // PutMetricAlarm request parameters (API reference, 2010-08-01).
    private static final Set<String> PARAMETERS = Set.of("ActionsEnabled", "AlarmActions", "AlarmDescription",
            "AlarmName", "ComparisonOperator", "DatapointsToAlarm", "Dimensions", "EvaluateLowSampleCountPercentile",
            "EvaluationCriteria", "EvaluationInterval", "EvaluationPeriods", "EvaluationWindow",
            "ExtendedStatistic", "InsufficientDataActions", "MetricName", "Metrics", "Namespace", "OKActions",
            "Period", "Statistic", "Tags", "Threshold", "ThresholdMetricId", "TreatMissingData", "Unit",
            "WarmUpConfiguration");
    private static final Set<String> SINGLE_METRIC_ONLY = Set.of("Namespace", "MetricName", "Dimensions", "Period",
            "Unit", "Statistic", "ExtendedStatistic");
    private static final Set<String> COMPARISONS = Set.of("GreaterThanOrEqualToThreshold", "GreaterThanThreshold",
            "LessThanThreshold", "LessThanOrEqualToThreshold");
    private static final Set<String> MISSING_DATA = Set.of("breaching", "notBreaching", "ignore", "missing");
    private static final Set<String> STATISTICS = Set.of("SampleCount", "Average", "Sum", "Minimum", "Maximum");
    private static final Set<String> QUERY_FIELDS = Set.of("Id", "Expression", "MetricStat", "Label", "ReturnData",
            "Period", "AccountId");
    private static final Pattern QUERY_ID = Pattern.compile("[a-z][a-zA-Z0-9_]{0,254}");
    private static final Pattern SNS_ARN = Pattern.compile("arn:aws[a-z-]*:sns:[a-z0-9-]+:\\d{12}:[A-Za-z0-9_-]+");

    @Test
    @DisplayName("Exactly six alarms, each valid put-metric-alarm input once rendered")
    void everyAlarmIsValidPutMetricAlarmInput() throws IOException {
        Map<String, JsonNode> alarms = renderedAlarms();
        assertThat(alarms).as("the audit's six alerts, nothing more").hasSize(6);

        Set<String> names = new HashSet<>();
        alarms.forEach((file, alarm) -> {
            List<String> problems = shapeProblems(alarm);
            assertThat(problems).as(file).isEmpty();
            assertThat(names.add(alarm.path("AlarmName").asText())).as("%s: unique AlarmName", file).isTrue();
        });
    }

    @Test
    @DisplayName("Alarms read only published application metrics, and every published metric is read")
    void alarmsAndAllowListCorrespond() throws IOException {
        Set<PublishedMetric> published = AlarmMetricNames.fromAllowList();
        Set<PublishedMetric> used = new HashSet<>();

        renderedAlarms().forEach((file, alarm) -> {
            for (JsonNode metric : metricsOf(alarm)) {
                String namespace = metric.path("Namespace").asText();
                if (AlarmMetricNames.NAMESPACE.equals(namespace)) {
                    PublishedMetric reference = new PublishedMetric(namespace,
                            metric.path("MetricName").asText(), dimensions(metric.path("Dimensions")));
                    assertThat(published).as("%s reads %s, which the application does not publish", file, reference)
                            .contains(reference);
                    used.add(reference);
                } else {
                    assertThat(AWS_NAMESPACES).as("%s: namespace %s", file, namespace).contains(namespace);
                }
            }
        });
        assertThat(used).as("every published metric has an alarm").containsExactlyInAnyOrderElementsOf(published);
    }

    @Test
    @DisplayName("The files use exactly the placeholders apply-alarms.sh renders")
    void placeholdersMatchTheApplyScript() throws IOException {
        Set<String> inFiles = new TreeSet<>();
        for (Path file : alarmFiles()) inFiles.addAll(placeholders(Files.readString(file)));
        Set<String> inScript = placeholders(Files.readString(ALARMS.resolve("apply-alarms.sh")));

        assertThat(inFiles).isEqualTo(inScript);
        assertThat(EXAMPLES.keySet()).containsExactlyInAnyOrderElementsOf(inScript);
    }

    // --- shape -------------------------------------------------------------------

    private static List<String> shapeProblems(JsonNode alarm) {
        List<String> problems = new ArrayList<>();
        alarm.fieldNames().forEachRemaining(field -> {
            if (!PARAMETERS.contains(field)) problems.add("unknown parameter " + field);
        });

        String name = alarm.path("AlarmName").asText("");
        if (name.isEmpty() || name.length() > 255) problems.add("AlarmName must be 1-255 characters");
        if (alarm.path("AlarmDescription").asText("").length() > 1024) problems.add("AlarmDescription over 1024");
        if (!alarm.path("ActionsEnabled").isBoolean()) problems.add("ActionsEnabled must be a boolean");
        for (String actions : new String[] {"AlarmActions", "OKActions"}) {
            JsonNode list = alarm.path(actions);
            if (!list.isArray() || list.isEmpty() || list.size() > 5) problems.add(actions + " must hold 1-5 ARNs");
            list.forEach(arn -> {
                if (!SNS_ARN.matcher(arn.asText()).matches()) problems.add(actions + " entry is not an SNS ARN");
            });
        }

        if (!COMPARISONS.contains(alarm.path("ComparisonOperator").asText())) problems.add("ComparisonOperator");
        if (!alarm.path("Threshold").isNumber()) problems.add("Threshold must be a number");
        if (!MISSING_DATA.contains(alarm.path("TreatMissingData").asText())) problems.add("TreatMissingData");
        int evaluationPeriods = alarm.path("EvaluationPeriods").asInt(0);
        if (evaluationPeriods < 1) problems.add("EvaluationPeriods must be at least 1");
        int datapoints = alarm.path("DatapointsToAlarm").asInt(evaluationPeriods);
        if (datapoints < 1 || datapoints > evaluationPeriods) problems.add("DatapointsToAlarm must be 1..N");

        boolean single = alarm.has("MetricName");
        boolean math = alarm.has("Metrics");
        if (single == math) problems.add("exactly one of MetricName and Metrics");
        int period;
        if (single) {
            if (!alarm.has("Namespace")) problems.add("Namespace is required with MetricName");
            if (!STATISTICS.contains(alarm.path("Statistic").asText())) problems.add("Statistic");
            dimensionProblems(alarm.path("Dimensions"), problems);
            period = alarm.path("Period").asInt(0);
        } else {
            SINGLE_METRIC_ONLY.forEach(field -> {
                if (alarm.has(field)) problems.add(field + " is not allowed with Metrics");
            });
            period = metricQueryProblems(alarm.path("Metrics"), problems);
        }
        if (!validPeriod(period)) problems.add("Period must be 10, 20, 30 or a multiple of 60");
        long window = (long) period * evaluationPeriods;
        if (window > (period < 3600 ? 86_400 : 604_800)) problems.add("Period x EvaluationPeriods too long");
        return problems;
    }

    /** Validates the MetricDataQuery array; returns the (single) period its metrics use. */
    private static int metricQueryProblems(JsonNode queries, List<String> problems) {
        if (!queries.isArray() || queries.isEmpty()) {
            problems.add("Metrics must be a non-empty array");
            return 0;
        }
        Set<String> ids = new HashSet<>();
        queries.forEach(query -> ids.add(query.path("Id").asText()));
        Set<Integer> periods = new HashSet<>();
        int returned = 0;
        for (JsonNode query : queries) {
            query.fieldNames().forEachRemaining(field -> {
                if (!QUERY_FIELDS.contains(field)) problems.add("unknown MetricDataQuery field " + field);
            });
            if (!QUERY_ID.matcher(query.path("Id").asText()).matches()) problems.add("bad query Id");
            if (!query.path("ReturnData").isBoolean()) problems.add("ReturnData must be a boolean");
            if (query.path("ReturnData").asBoolean()) returned++;
            boolean stat = query.has("MetricStat");
            boolean expression = query.has("Expression");
            if (stat == expression) problems.add("query needs exactly one of MetricStat and Expression");
            if (stat) {
                JsonNode metricStat = query.path("MetricStat");
                JsonNode metric = metricStat.path("Metric");
                if (metric.path("Namespace").asText().isEmpty() || metric.path("MetricName").asText().isEmpty()) {
                    problems.add("MetricStat.Metric needs Namespace and MetricName");
                }
                dimensionProblems(metric.path("Dimensions"), problems);
                if (!STATISTICS.contains(metricStat.path("Stat").asText())) problems.add("MetricStat.Stat");
                periods.add(metricStat.path("Period").asInt(0));
            }
            if (expression) {
                // Query ids are lower-case; functions and keywords (IF, FILL, AND) are not.
                Matcher reference = Pattern.compile("\\b[a-z][a-zA-Z0-9_]*\\b")
                        .matcher(query.path("Expression").asText());
                while (reference.find()) {
                    if (!ids.contains(reference.group())) problems.add("unknown query id " + reference.group());
                }
            }
        }
        if (returned != 1) problems.add("exactly one query must have ReturnData true");
        if (periods.size() != 1) problems.add("all MetricStat periods must match");
        return periods.isEmpty() ? 0 : periods.iterator().next();
    }

    private static void dimensionProblems(JsonNode dimensions, List<String> problems) {
        if (dimensions.isMissingNode()) return;
        if (!dimensions.isArray() || dimensions.size() > 30) {
            problems.add("Dimensions must be an array of at most 30");
            return;
        }
        dimensions.forEach(dimension -> {
            if (dimension.path("Name").asText().isEmpty() || dimension.path("Value").asText().isEmpty()) {
                problems.add("each Dimension needs Name and Value");
            }
        });
    }

    private static boolean validPeriod(int period) {
        return period == 10 || period == 20 || period == 30 || (period >= 60 && period % 60 == 0);
    }

    // --- helpers -----------------------------------------------------------------

    private static List<JsonNode> metricsOf(JsonNode alarm) {
        List<JsonNode> metrics = new ArrayList<>();
        if (alarm.has("MetricName")) metrics.add(alarm);
        alarm.path("Metrics").forEach(query -> {
            if (query.has("MetricStat")) metrics.add(query.path("MetricStat").path("Metric"));
        });
        return metrics;
    }

    private static Map<String, String> dimensions(JsonNode dimensions) {
        Map<String, String> map = new LinkedHashMap<>();
        dimensions.forEach(dimension -> map.put(dimension.path("Name").asText(), dimension.path("Value").asText()));
        return map;
    }

    private static Map<String, JsonNode> renderedAlarms() throws IOException {
        Map<String, JsonNode> alarms = new LinkedHashMap<>();
        for (Path file : alarmFiles()) {
            String text = Files.readString(file);
            for (Map.Entry<String, String> example : EXAMPLES.entrySet()) {
                text = text.replace(example.getKey(), example.getValue());
            }
            assertThat(placeholders(text)).as("%s: unrendered placeholders", file.getFileName()).isEmpty();
            alarms.put(file.getFileName().toString(), JSON.readTree(text));
        }
        return alarms;
    }

    private static List<Path> alarmFiles() throws IOException {
        try (Stream<Path> files = Files.list(ALARMS)) {
            return files.filter(file -> file.getFileName().toString().matches("\\d\\d-.+\\.json")).sorted().toList();
        }
    }

    private static Set<String> placeholders(String text) {
        Set<String> found = new TreeSet<>();
        Matcher matcher = PLACEHOLDER.matcher(text);
        while (matcher.find()) found.add(matcher.group());
        return found;
    }
}
