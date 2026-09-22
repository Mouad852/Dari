package ma.dari.api.support;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.sql.DriverManager;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves the migration chain can build a completely empty PostGIS database.
 * This deliberately does not load the Spring context: a migration failure
 * should be reported independently of Firebase, SMTP, or application beans.
 */
class FlywayMigrationSmokeTest {

    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(
            DockerImageName.parse("postgis/postgis:16-3.4")
                    .asCompatibleSubstituteFor("postgres"))
            .withDatabaseName("dari_migration_smoke")
            .withUsername("dari")
            .withPassword("dari_migration_smoke");

    @BeforeAll
    static void startDatabase() {
        POSTGRES.start();
    }

    @AfterAll
    static void stopDatabase() {
        POSTGRES.stop();
    }

    @Test
    void everyFlywayMigrationAppliesToAnEmptyPostgisDatabase() throws Exception {
        var result = Flyway.configure()
                .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .cleanDisabled(true)
                .load()
                .migrate();

        assertThat(result.success).isTrue();
        assertThat(result.migrationsExecuted).isGreaterThan(0);

        try (var connection = DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var migrations = connection.createStatement().executeQuery(
                     "SELECT COUNT(*), MAX(version::integer) FROM flyway_schema_history WHERE success = true");
             var postgis = connection.createStatement().executeQuery("SELECT postgis_full_version()")) {
            assertThat(migrations.next()).isTrue();
            assertThat(migrations.getLong(1)).isEqualTo(result.migrationsExecuted);
            assertThat(migrations.getInt(2)).isEqualTo(26);

            assertThat(postgis.next()).isTrue();
            assertThat(postgis.getString(1)).contains("POSTGIS");
        }
    }
}
