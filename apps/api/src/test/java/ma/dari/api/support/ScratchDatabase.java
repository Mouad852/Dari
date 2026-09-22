package ma.dari.api.support;

import org.flywaydb.core.Flyway;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

/**
 * A throwaway database on the suite's shared PostGIS container, for tests that
 * migrate a schema one version at a time and seed data in between.
 *
 * <p>The shared {@code dari} database is already at the latest version (the
 * application context migrated it) and every other test depends on that, so a
 * migration test never touches it. Each instance gets its own uniquely named
 * database on the same server and drops it on close; starting another
 * container per test would cost more than the test itself.
 */
public final class ScratchDatabase implements AutoCloseable {

    private final String name;

    private ScratchDatabase(String name) {
        this.name = name;
    }

    public static ScratchDatabase create(String prefix) throws SQLException {
        String name = prefix + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        try (Connection admin = connect(AbstractIntegrationTest.POSTGRES.getDatabaseName());
             var statement = admin.createStatement()) {
            statement.execute("CREATE DATABASE " + name);
        }
        return new ScratchDatabase(name);
    }

    /** Flyway over the application's real migrations, stopping at {@code targetVersion}. */
    public Flyway flyway(String targetVersion) {
        return Flyway.configure()
                .dataSource(url(name), AbstractIntegrationTest.POSTGRES.getUsername(),
                        AbstractIntegrationTest.POSTGRES.getPassword())
                .locations("classpath:db/migration")
                .cleanDisabled(true)
                .target(targetVersion)
                .load();
    }

    public Connection connect() throws SQLException {
        return connect(name);
    }

    @Override
    public void close() throws SQLException {
        try (Connection admin = connect(AbstractIntegrationTest.POSTGRES.getDatabaseName());
             var statement = admin.createStatement()) {
            statement.execute("DROP DATABASE IF EXISTS " + name + " WITH (FORCE)");
        }
    }

    private static Connection connect(String database) throws SQLException {
        return DriverManager.getConnection(url(database),
                AbstractIntegrationTest.POSTGRES.getUsername(), AbstractIntegrationTest.POSTGRES.getPassword());
    }

    private static String url(String database) {
        return "jdbc:postgresql://" + AbstractIntegrationTest.POSTGRES.getHost() + ":"
                + AbstractIntegrationTest.POSTGRES.getMappedPort(5432) + "/" + database;
    }
}
