package ma.dari.api.support;

import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.postgresql.util.PSQLException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import javax.sql.DataSource;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The statement timeout protects the pool from runaway application queries, and
 * must never reach Flyway, where a legitimately slow migration would be killed
 * halfway through a deploy.
 *
 * <p>The timeout is lowered to 1s here so the proof takes seconds; the probe
 * migration sleeps 2s, past it.
 */
@TestPropertySource(properties = "DARI_DB_STATEMENT_TIMEOUT=1s")
class DatabaseTimeoutIntegrationTest extends AbstractIntegrationTest {

    private static final String QUERY_CANCELED = "57014";

    @Autowired
    DataSource dataSource;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    Flyway flyway;

    @AfterEach
    void dropProbeHistory() {
        jdbc.execute("DROP TABLE IF EXISTS timeout_probe_history");
        jdbc.execute("DROP TABLE IF EXISTS timeout_probe_control_history");
    }

    @Test
    @DisplayName("An application query running past the statement timeout is cancelled by the server")
    void applicationQueryIsCancelled() {
        Instant start = Instant.now();

        assertThatThrownBy(() -> jdbc.queryForObject("SELECT pg_sleep(5)::text", String.class))
                .isInstanceOf(DataAccessException.class)
                .rootCause()
                .isInstanceOf(PSQLException.class)
                .satisfies(cause -> assertThat(((PSQLException) cause).getSQLState()).isEqualTo(QUERY_CANCELED));

        assertThat(Duration.between(start, Instant.now())).isLessThan(Duration.ofSeconds(4));
    }

    @Test
    @DisplayName("Pool connections carry the statement and socket timeouts")
    void poolConnectionsCarryTimeouts() throws Exception {
        assertThat(jdbc.queryForObject("SHOW statement_timeout", String.class)).isEqualTo("1s");
        try (var connection = dataSource.getConnection()) {
            // pgjdbc reports its socketTimeout as the network timeout, in ms.
            assertThat(connection.getNetworkTimeout()).isEqualTo(45_000);
        }
    }

    @Test
    @DisplayName("Flyway uses its own unpooled connections, without the statement timeout")
    void flywayHasItsOwnConnections() throws Exception {
        DataSource migrations = flyway.getConfiguration().getDataSource();

        assertThat(migrations).isNotSameAs(dataSource).isNotInstanceOf(HikariDataSource.class);
        try (var connection = migrations.getConnection();
             var result = connection.createStatement().executeQuery("SHOW statement_timeout")) {
            assertThat(result.next()).isTrue();
            assertThat(result.getString(1)).isEqualTo("0");
        }
    }

    @Test
    @DisplayName("A migration running past the statement timeout completes under Flyway's configuration")
    void slowMigrationCompletes() {
        var result = Flyway.configure()
                .configuration(flyway.getConfiguration())
                .locations("classpath:db/timeout-probe")
                .table("timeout_probe_history")
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .load()
                .migrate();

        assertThat(result.success).isTrue();
        assertThat(result.migrationsExecuted).isEqualTo(1);
        // The application pool is untouched by Flyway's SET statement_timeout = 0.
        assertThat(jdbc.queryForObject("SHOW statement_timeout", String.class)).isEqualTo("1s");
    }

    @Test
    @DisplayName("Control: the same migration over the application pool is killed by the timeout")
    void slowMigrationOverThePoolFails() {
        var overPool = Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/timeout-probe")
                .table("timeout_probe_control_history")
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .load();

        assertThatThrownBy(overPool::migrate)
                .isInstanceOf(FlywayException.class)
                .hasStackTraceContaining("canceling statement due to statement timeout");
    }
}
