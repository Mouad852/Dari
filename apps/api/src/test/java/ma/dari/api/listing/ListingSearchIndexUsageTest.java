package ma.dari.api.listing;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.sql.DataSource;

import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.Banner;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.Query;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Does the sorted search actually use the indexes V15 built for it?
 *
 * <p>Nothing else in the suite asserts a query plan, which is how the question
 * stayed open: correctness tests pass either way, and a sequential scan over a
 * fixture of ten rows is fast. This runs the repository's own SQL — read from
 * the {@code @Query} annotation, so it cannot drift from what production
 * executes — against the 50,000-row load-test fixture, and asserts on the plan
 * (node type and index name), never on timings.
 *
 * <p>The query orders by {@code CASE WHEN :sort = ... THEN column END}. It is
 * planned here the way a JDBC execution with bound values is planned (a custom
 * plan), where the sort value folds the CASE away and the index serves the
 * ORDER BY. Measured and recorded, not asserted: under a generic plan
 * ({@code plan_cache_mode = force_generic_plan}) the same page is a sequential
 * scan plus a top-N sort (415 ms against 0.1 ms). Splitting the query per sort
 * did not change that — the optional {@code (:city IS NULL OR l.city = :city)}
 * filter is what keeps the index out of a generic plan — so the query stays as
 * it is, and the pool forbids generic plans instead
 * ({@code plan_cache_mode = force_custom_plan}, asserted by
 * {@link #pooledPreparedSearchKeepsItsIndex}).
 *
 * <p>Its own container, seeded once for the class: the shared suite database
 * holds a handful of listings on purpose, and 50,000 more would change what
 * every other test measures.
 */
class ListingSearchIndexUsageTest {

    private static final String CITY = "Rabat";
    private static final int PAGE = 20;
    private static final String PRICE_INDEX = "idx_listings_searchable_price";
    private static final String UPDATED_INDEX = "idx_listings_searchable_updated";
    private static final Pattern NAMED_PARAMETER = Pattern.compile("(?<!:):(\\w+)");

    /**
     * PREPARE parameter types, by name. Spelled out because a bare
     * {@code $n IS NULL} gives Postgres nothing to infer a type from.
     */
    private static final Map<String, String> PARAMETER_TYPES = Map.ofEntries(
            Map.entry("city", "text"),
            Map.entry("neighborhood", "text"),
            Map.entry("minPrice", "numeric"),
            Map.entry("maxPrice", "numeric"),
            Map.entry("propertyTypes", "text[]"),
            Map.entry("roomTypes", "text[]"),
            Map.entry("furnishings", "text[]"),
            Map.entry("availableBy", "date"),
            Map.entry("amenityCodes", "text[]"),
            Map.entry("amenityCount", "int"),
            Map.entry("sort", "text"),
            Map.entry("lastPrice", "numeric"),
            Map.entry("lastCreatedAt", "timestamptz"),
            Map.entry("lastUpdatedAt", "timestamptz"),
            Map.entry("lastId", "uuid"),
            Map.entry("limit", "int"));

    private static PostgreSQLContainer<?> postgres;
    private static Connection connection;
    private static ConfigurableApplicationContext application;

    /**
     * Only the DataSource auto-configuration, bound from the same
     * application.yml the API starts with, so the pool's connection options
     * are the ones production gets. The production profile itself is left
     * off: its startup validator wants SMTP, Firebase and the rest, and it
     * overrides only the URL and credentials of this block.
     */
    @Configuration(proxyBeanMethods = false)
    @ImportAutoConfiguration(DataSourceAutoConfiguration.class)
    static class DataSourceOnly {
    }

    @BeforeAll
    static void startSeededDatabase() throws Exception {
        postgres = new PostgreSQLContainer<>(
                DockerImageName.parse("postgis/postgis:16-3.4").asCompatibleSubstituteFor("postgres"))
                .withDatabaseName("dari_explain")
                .withUsername("dari")
                .withPassword("dari_test")
                .withCopyFileToContainer(
                        MountableFile.forHostPath(seedScript()),
                        "/tmp/seed-load-test-data.sql");
        postgres.start();

        Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/migration")
                .load()
                .migrate();

        // Through psql rather than JDBC: the fixture is one DO $$ ... $$ block
        // whose body is full of semicolons, and it needs its own SET.
        var seeded = postgres.execInContainer("psql", "-v", "ON_ERROR_STOP=1",
                "-U", postgres.getUsername(), "-d", postgres.getDatabaseName(),
                "-f", "/tmp/seed-load-test-data.sql");
        if (seeded.getExitCode() != 0) {
            throw new IllegalStateException("seeding failed: " + seeded.getStderr());
        }

        connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        try (Statement statement = connection.createStatement()) {
            statement.execute("ANALYZE");
        }

        // Command-line arguments, not default properties: application.yml's own
        // ${DB_URL:...} would outrank a default.
        application = new SpringApplicationBuilder(DataSourceOnly.class)
                .web(WebApplicationType.NONE)
                .bannerMode(Banner.Mode.OFF)
                .logStartupInfo(false)
                .run("--spring.datasource.url=" + postgres.getJdbcUrl(),
                        "--spring.datasource.username=" + postgres.getUsername(),
                        "--spring.datasource.password=" + postgres.getPassword());
    }

    @AfterAll
    static void stopSeededDatabase() throws Exception {
        if (application != null) {
            application.close();
        }
        if (connection != null) {
            connection.close();
        }
        if (postgres != null) {
            postgres.stop();
        }
    }

    private static Path seedScript() {
        return Path.of("..", "..", "infra", "scripts", "seed-load-test-data.sql").toAbsolutePath().normalize();
    }

    @Test
    @DisplayName("50,000 published listings are seeded")
    void theFixtureIsWhatTheMeasurementAssumes() throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery("SELECT COUNT(*) FROM published_listings")) {
            rows.next();
            assertThat(rows.getInt(1)).isGreaterThanOrEqualTo(50_000);
        }
    }

    @Test
    @DisplayName("both price sorts scan the price index, first page and resumed page alike")
    void priceSortsUseTheirIndex() throws Exception {
        for (String sort : List.of("priceasc", "pricedesc")) {
            assertIndexScan(explain(sort, false), PRICE_INDEX, sort + ", first page");
            assertIndexScan(explain(sort, true), PRICE_INDEX, sort + ", resumed page");
        }
    }

    @Test
    @DisplayName("the recently-updated sort scans the updated index, first page and resumed page alike")
    void updatedSortUsesItsIndex() throws Exception {
        assertIndexScan(explain("updated", false), UPDATED_INDEX, "updated, first page");
        assertIndexScan(explain("updated", true), UPDATED_INDEX, "updated, resumed page");
    }

    /**
     * What a busy pool actually runs. The driver turns a statement it has seen
     * five times into a named server-side one, and five executions later
     * PostgreSQL may reuse one generic plan, in which the city and the sort are
     * unknown, whenever that plan's estimate beats the average of the custom
     * plans so far. Browsing every city is one of those executions and costs a
     * full scan either way, which raises that average; if the generic plan
     * ever won, the cheap one-city search that follows would inherit its scan.
     *
     * <p>On this fixture it does not win under {@code auto} either (the generic
     * estimate is several orders of magnitude above the custom ones), so the
     * plans alone cannot tell the two modes apart. The pool's
     * {@code plan_cache_mode = force_custom_plan} (application.yml) makes that a
     * guarantee instead of a cost-model outcome, and the mode is asserted first.
     */
    @Test
    @DisplayName("on a pooled connection, the prepared search keeps its index after six all-city executions")
    void pooledPreparedSearchKeepsItsIndex() throws Exception {
        DataSource dataSource = application.getBean(DataSource.class);
        assertThat(dataSource).isInstanceOf(HikariDataSource.class);

        List<String> names = new ArrayList<>();
        String prepared = numbered(sortedSearchSql(), names);
        try (Connection pooled = dataSource.getConnection();
             Statement statement = pooled.createStatement()) {
            // The plans below come out the same under the default `auto` on this
            // fixture: the setting is the guarantee, so it is asserted directly.
            try (ResultSet mode = statement.executeQuery("SHOW plan_cache_mode")) {
                mode.next();
                assertThat(mode.getString(1)).isEqualTo("force_custom_plan");
            }
            statement.execute("PREPARE sorted_search(" + String.join(", ",
                    names.stream().map(PARAMETER_TYPES::get).toList()) + ") AS " + prepared);
            try {
                for (String sort : List.of("priceasc", "pricedesc", "updated")) {
                    String index = sort.equals("updated") ? UPDATED_INDEX : PRICE_INDEX;
                    String browse = "EXECUTE sorted_search(" + literals(names, parameters(null, sort, Map.of())) + ")";
                    for (int run = 0; run < 6; run++) {
                        try (ResultSet rows = statement.executeQuery(browse)) {
                            while (rows.next()) {
                                // drain the page, as the application does
                            }
                        }
                    }
                    for (boolean resumed : List.of(false, true)) {
                        Map<String, Object> cursor = resumed ? lastRowOfFirstPage(sort) : Map.of();
                        String execute = "EXECUTE sorted_search(" + literals(names, parameters(sort, cursor)) + ")";
                        String plan;
                        try (ResultSet rows = statement.executeQuery("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + execute)) {
                            rows.next();
                            plan = rows.getString(1);
                        }
                        String description = sort + (resumed ? ", resumed page" : ", first page") + ", prepared";
                        assertIndexScan(plan, index, description);
                        // A custom plan carries the value; a generic one would say $1.
                        assertThat(plan).describedAs(description).contains("'" + CITY + "'");
                    }
                }
            } finally {
                statement.execute("DEALLOCATE sorted_search");
            }
        }
    }

    private static void assertIndexScan(String plan, String index, String description) {
        assertThat(plan)
                .describedAs(description)
                .contains("\"Index Name\": \"" + index + "\"")
                .doesNotContain("\"Node Type\": \"Seq Scan\"")
                .doesNotContain("\"Node Type\": \"Sort\"");
    }

    /** EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) of one page, values bound. */
    private String explain(String sort, boolean resumed) throws Exception {
        Map<String, Object> cursor = resumed ? lastRowOfFirstPage(sort) : Map.of();
        List<String> names = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        String sql = "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) "
                + positional(sortedSearchSql(), parameters(sort, cursor), names, values);
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, names, values);
            try (ResultSet rows = statement.executeQuery()) {
                rows.next();
                return rows.getString(1);
            }
        }
    }

    /** The last row of page one: the keyset a real "voir plus" resumes from. */
    private Map<String, Object> lastRowOfFirstPage(String sort) throws Exception {
        List<String> names = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        String sql = positional(sortedSearchSql(), parameters(sort, Map.of()), names, values);
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            bind(statement, names, values);
            try (ResultSet rows = statement.executeQuery()) {
                Object id = null;
                BigDecimal price = null;
                Object created = null;
                Object updated = null;
                while (rows.next()) {
                    id = rows.getObject("id");
                    price = rows.getBigDecimal("price_rent");
                    created = rows.getObject("created_at");
                    updated = rows.getObject("updated_at");
                }
                assertThat(id).describedAs("a full first page to resume from").isNotNull();
                return Map.of("lastId", id, "lastPrice", price, "lastCreatedAt", created, "lastUpdatedAt", updated);
            }
        }
    }

    /** The production SQL, straight from the annotation, so the two cannot drift. */
    private static String sortedSearchSql() {
        for (var method : ListingSearchRepository.class.getMethods()) {
            if (method.getName().equals("searchByLocationSorted")) {
                return method.getAnnotation(Query.class).value();
            }
        }
        throw new IllegalStateException("searchByLocationSorted is gone from ListingSearchRepository");
    }

    /** One city, no other filter, a first page or the page after {@code cursor}. */
    private static Map<String, Object> parameters(String sort, Map<String, Object> cursor) {
        return parameters(CITY, sort, cursor);
    }

    /** {@code city} null is the all-city browse. */
    private static Map<String, Object> parameters(String city, String sort, Map<String, Object> cursor) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("city", city);
        parameters.put("neighborhood", null);
        parameters.put("minPrice", null);
        parameters.put("maxPrice", null);
        parameters.put("propertyTypes", null);
        parameters.put("roomTypes", null);
        parameters.put("furnishings", null);
        parameters.put("availableBy", null);
        parameters.put("amenityCodes", null);
        parameters.put("amenityCount", 0);
        parameters.put("sort", sort);
        parameters.put("lastPrice", cursor.get("lastPrice"));
        parameters.put("lastCreatedAt", cursor.get("lastCreatedAt"));
        parameters.put("lastUpdatedAt", cursor.get("lastUpdatedAt"));
        parameters.put("lastId", cursor.get("lastId"));
        parameters.put("limit", PAGE);
        return parameters;
    }

    /** Rewrites :name to ? and collects the names and values in the order they appear. */
    private static String positional(String sql, Map<String, Object> parameters, List<String> names, List<Object> values) {
        Matcher matcher = NAMED_PARAMETER.matcher(sql);
        StringBuilder rewritten = new StringBuilder();
        while (matcher.find()) {
            String name = matcher.group(1);
            if (!parameters.containsKey(name)) {
                throw new IllegalStateException("no value for :" + name);
            }
            names.add(name);
            values.add(parameters.get(name));
            matcher.appendReplacement(rewritten, "?");
        }
        matcher.appendTail(rewritten);
        return rewritten.toString();
    }

    /** Rewrites :name to $n, one number per distinct name, collecting the names in that order. */
    private static String numbered(String sql, List<String> names) {
        Matcher matcher = NAMED_PARAMETER.matcher(sql);
        StringBuilder rewritten = new StringBuilder();
        while (matcher.find()) {
            String name = matcher.group(1);
            if (!PARAMETER_TYPES.containsKey(name)) {
                throw new IllegalStateException("no PREPARE type for :" + name);
            }
            if (!names.contains(name)) {
                names.add(name);
            }
            matcher.appendReplacement(rewritten, "\\$" + (names.indexOf(name) + 1));
        }
        matcher.appendTail(rewritten);
        return rewritten.toString();
    }

    /**
     * EXECUTE takes expressions, not bind parameters, so the values are
     * written out; PREPARE's declared types coerce each quoted literal.
     */
    private static String literals(List<String> names, Map<String, Object> parameters) {
        List<String> rendered = new ArrayList<>();
        for (String name : names) {
            Object value = parameters.get(name);
            if (value == null) {
                rendered.add("NULL");
            } else {
                String text = value instanceof Timestamp timestamp ? timestamp.toInstant().toString()
                        : value instanceof BigDecimal decimal ? decimal.toPlainString()
                        : value.toString();
                rendered.add("'" + text.replace("'", "''") + "'");
            }
        }
        return String.join(", ", rendered);
    }

    /**
     * Hibernate binds a null BigDecimal as numeric and a null String as
     * varchar; an untyped null is what makes Postgres answer "could not
     * determine data type of parameter". Parameters that sit inside a CAST in
     * the SQL get an untyped null, so the cast decides, as in production.
     */
    private static final Map<String, Integer> NULL_TYPES = Map.of(
            "neighborhood", Types.VARCHAR,
            "minPrice", Types.NUMERIC,
            "maxPrice", Types.NUMERIC,
            "lastPrice", Types.NUMERIC);

    private static void bind(PreparedStatement statement, List<String> names, List<Object> values) throws Exception {
        for (int i = 0; i < values.size(); i++) {
            Object value = values.get(i);
            if (value == null) {
                statement.setNull(i + 1, NULL_TYPES.getOrDefault(names.get(i), Types.OTHER));
            } else {
                statement.setObject(i + 1, value);
            }
        }
    }
}
