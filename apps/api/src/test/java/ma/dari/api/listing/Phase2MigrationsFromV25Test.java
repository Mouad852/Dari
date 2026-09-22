package ma.dari.api.listing;

import ma.dari.api.support.ScratchDatabase;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A database that really was at V25 with rows in it, migrated forward to the
 * latest version in one deploy: what production does, as opposed to
 * FlywayMigrationSmokeTest's empty database.
 */
class Phase2MigrationsFromV25Test {

    @Test
    void v26ToV28ApplyOverExistingDataAndBackfillIt() throws Exception {
        try (ScratchDatabase db = ScratchDatabase.create("phase2_from_v25")) {
            db.flyway("25").migrate();

            UUID owner = UUID.randomUUID();
            String avatarKey = "avatars/" + owner + "/" + UUID.randomUUID() + ".jpg";
            Instant ninetyDaysAgo = Instant.now().minus(Duration.ofDays(90));
            UUID published, warned, suspendedFromPublished, suspendedWithoutPrior, suspendedFromReview,
                    pending, draft, expired, deletedPublished;
            String pendingKey = "listings/" + UUID.randomUUID() + "/" + UUID.randomUUID() + ".jpg";
            String deletedKey = "listings/" + UUID.randomUUID() + "/" + UUID.randomUUID() + ".jpg";

            try (Connection connection = db.connect()) {
                execute(connection, "INSERT INTO users (id, firebase_uid, email, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)",
                        owner, "uid-" + owner, owner + "@example.ma", "Migration Owner", "https://cdn.example/" + avatarKey);
                published = listing(connection, owner, "PUBLISHED", null, ninetyDaysAgo, null, null);
                // Warned by the old job and immortal ever since.
                warned = listing(connection, owner, "PUBLISHED", null, ninetyDaysAgo, ninetyDaysAgo, null);
                suspendedFromPublished = listing(connection, owner, "SUSPENDED", "PUBLISHED", ninetyDaysAgo, null, null);
                suspendedWithoutPrior = listing(connection, owner, "SUSPENDED", null, ninetyDaysAgo, null, null);
                suspendedFromReview = listing(connection, owner, "SUSPENDED", "PENDING_REVIEW", ninetyDaysAgo, null, null);
                pending = listing(connection, owner, "PENDING_REVIEW", null, ninetyDaysAgo, null, null);
                draft = listing(connection, owner, "DRAFT", null, ninetyDaysAgo, null, null);
                expired = listing(connection, owner, "EXPIRED", null, ninetyDaysAgo, ninetyDaysAgo, null);
                deletedPublished = listing(connection, owner, "PUBLISHED", null, ninetyDaysAgo, ninetyDaysAgo, Instant.now());
                execute(connection, "INSERT INTO media_cleanup (id, storage_key, status, attempts) VALUES (?, ?, 'PENDING', 3)",
                        UUID.randomUUID(), pendingKey);
                execute(connection, "INSERT INTO media_cleanup (id, storage_key, status) VALUES (?, ?, 'DELETED')",
                        UUID.randomUUID(), deletedKey);
            }

            var result = db.flyway("latest").migrate();
            assertThat(result.migrationsExecuted).isEqualTo(3);
            assertThat(result.targetSchemaVersion).isEqualTo("28");

            try (Connection connection = db.connect()) {
                // V26
                assertThat(text(connection, "SELECT avatar_storage_key FROM users WHERE id = ?", owner)).isEqualTo(avatarKey);

                // V27: existing rows untouched, DEAD now allowed, garbage still refused.
                assertThat(text(connection, "SELECT status || ':' || attempts FROM media_cleanup WHERE storage_key = ?", pendingKey))
                        .isEqualTo("PENDING:3");
                assertThat(text(connection, "SELECT status FROM media_cleanup WHERE storage_key = ?", deletedKey))
                        .isEqualTo("DELETED");
                execute(connection, "UPDATE media_cleanup SET status = 'DEAD' WHERE storage_key = ?", pendingKey);
                assertThatThrownBy(() -> execute(connection,
                        "UPDATE media_cleanup SET status = 'LOST' WHERE storage_key = ?", deletedKey))
                        .hasMessageContaining("media_cleanup_status_check");

                // V28: a fresh 60-day window from the deploy for everything that
                // is or will return to PUBLISHED, and a fresh warning.
                for (UUID id : new UUID[] {published, warned, suspendedFromPublished, suspendedWithoutPrior}) {
                    assertThat(daysUntilExpiry(connection, id)).as("window for %s", id).isBetween(59.99, 60.0);
                    assertThat(text(connection, "SELECT expiry_warned_at::text FROM listings WHERE id = ?", id)).isNull();
                }
                for (UUID id : new UUID[] {suspendedFromReview, pending, draft, expired, deletedPublished}) {
                    assertThat(text(connection, "SELECT expires_at::text FROM listings WHERE id = ?", id))
                            .as("no window for %s", id).isNull();
                }
                assertThat(text(connection, "SELECT expiry_warned_at::text FROM listings WHERE id = ?", expired))
                        .as("rows outside the backfill keep their warning marker").isNotNull();
                assertThat(text(connection, "SELECT status::text FROM listings WHERE id = ?", warned)).isEqualTo("PUBLISHED");
                assertThat(text(connection, "SELECT expires_at::text FROM published_listings WHERE id = ?", published))
                        .isNotNull();
            }
        }
    }

    private static UUID listing(Connection connection, UUID owner, String status, String priorStatus,
                                Instant updatedAt, Instant warnedAt, Instant deletedAt) throws SQLException {
        UUID id = UUID.randomUUID();
        execute(connection, """
                INSERT INTO listings (id, owner_id, title, city, neighborhood, latitude, longitude, price_rent,
                                      status, prior_status, updated_at, expiry_warned_at, deleted_at)
                VALUES (?, ?, 'Chambre migrée', 'Rabat', 'Agdal', 33.9716, -6.8498, 2500,
                        ?::listing_status, ?::listing_status, ?, ?, ?)
                """, id, owner, status, priorStatus, Timestamp.from(updatedAt),
                warnedAt == null ? null : Timestamp.from(warnedAt), deletedAt == null ? null : Timestamp.from(deletedAt));
        return id;
    }

    private static double daysUntilExpiry(Connection connection, UUID id) throws SQLException {
        try (var select = connection.prepareStatement(
                "SELECT EXTRACT(EPOCH FROM expires_at - now()) / 86400 FROM listings WHERE id = ?")) {
            select.setObject(1, id);
            try (var rows = select.executeQuery()) {
                assertThat(rows.next()).isTrue();
                return rows.getDouble(1);
            }
        }
    }

    private static String text(Connection connection, String sql, Object parameter) throws SQLException {
        try (var select = connection.prepareStatement(sql)) {
            select.setObject(1, parameter);
            try (var rows = select.executeQuery()) {
                assertThat(rows.next()).isTrue();
                return rows.getString(1);
            }
        }
    }

    private static void execute(Connection connection, String sql, Object... parameters) throws SQLException {
        try (var statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < parameters.length; i++) {
                statement.setObject(i + 1, parameters[i]);
            }
            statement.executeUpdate();
        }
    }
}
