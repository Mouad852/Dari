package ma.dari.api.user;

import ma.dari.api.support.ScratchDatabase;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V26 backfills {@code users.avatar_storage_key} from the rendered URLs earlier
 * releases stored, on a database that really was at V25 with data in it.
 */
class AvatarStorageKeyMigrationTest {

    @Test
    void backfillsTheKeyFromBothUrlShapesAndLeavesEverythingElseNull() throws Exception {
        try (ScratchDatabase db = ScratchDatabase.create("avatar_key_migration")) {
            db.flyway("25").migrate();

            UUID relative = UUID.randomUUID();
            UUID absolute = UUID.randomUUID();
            UUID prefixed = UUID.randomUUID();
            UUID none = UUID.randomUUID();
            UUID garbage = UUID.randomUUID();
            UUID foreign = UUID.randomUUID();
            UUID listingPhoto = UUID.randomUUID();
            UUID withQuery = UUID.randomUUID();
            String relativeKey = avatarKey(relative);
            String absoluteKey = avatarKey(absolute);
            String prefixedKey = avatarKey(prefixed);

            try (Connection connection = db.connect()) {
                insertUser(connection, relative, "/uploads/" + relativeKey);
                insertUser(connection, absolute, "https://cdn.example/" + absoluteKey);
                insertUser(connection, prefixed, "https://media.example.ma/prod/media/" + prefixedKey);
                insertUser(connection, none, null);
                insertUser(connection, garbage, "not a url at all");
                // Someone else's avatar key must never become this person's:
                // deleting this account would then delete the other person's photo.
                insertUser(connection, foreign, "/uploads/" + avatarKey(UUID.randomUUID()));
                insertUser(connection, listingPhoto, "/uploads/listings/" + listingPhoto + "/" + UUID.randomUUID() + ".jpg");
                insertUser(connection, withQuery, "https://cdn.example/" + avatarKey(withQuery) + "?v=2");
            }

            var result = db.flyway("26").migrate();
            assertThat(result.targetSchemaVersion).isEqualTo("26");

            try (Connection connection = db.connect()) {
                assertThat(storageKey(connection, relative)).isEqualTo(relativeKey);
                assertThat(storageKey(connection, absolute)).isEqualTo(absoluteKey);
                assertThat(storageKey(connection, prefixed)).isEqualTo(prefixedKey);
                assertThat(storageKey(connection, none)).isNull();
                assertThat(storageKey(connection, garbage)).isNull();
                assertThat(storageKey(connection, foreign)).isNull();
                assertThat(storageKey(connection, listingPhoto)).isNull();
                assertThat(storageKey(connection, withQuery)).isNull();

                // Expand only: the legacy column is still there, untouched.
                assertThat(avatarUrl(connection, absolute)).isEqualTo("https://cdn.example/" + absoluteKey);
            }
        }
    }

    @Test
    void theKeyFollowsAvatarUrlWrittenByThePreviousReleaseButNothingElse() throws Exception {
        try (ScratchDatabase db = ScratchDatabase.create("avatar_key_trigger")) {
            db.flyway("26").migrate();
            UUID id = UUID.randomUUID();

            try (Connection connection = db.connect()) {
                insertUser(connection, id, null);

                // The previous release only knows avatar_url.
                String olderReleaseKey = avatarKey(id);
                update(connection, "UPDATE users SET avatar_url = ? WHERE id = ?", "https://cdn.example/" + olderReleaseKey, id);
                assertThat(storageKey(connection, id)).isEqualTo(olderReleaseKey);

                // This release writes only the key; Hibernate still rewrites the
                // unchanged avatar_url in the same statement, which must not
                // overwrite the key it just set.
                String currentKey = avatarKey(id);
                update(connection, "UPDATE users SET avatar_storage_key = ?, avatar_url = avatar_url WHERE id = ?", currentKey, id);
                assertThat(storageKey(connection, id)).isEqualTo(currentKey);

                // Clearing the legacy column (account deletion's scrub) clears the key.
                update(connection, "UPDATE users SET avatar_url = NULL WHERE id = ?", id);
                assertThat(storageKey(connection, id)).isNull();
            }
        }
    }

    private static String avatarKey(UUID owner) {
        return "avatars/" + owner + "/" + UUID.randomUUID() + ".jpg";
    }

    private static void insertUser(Connection connection, UUID id, String avatarUrl) throws SQLException {
        try (var insert = connection.prepareStatement(
                "INSERT INTO users (id, firebase_uid, email, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)")) {
            insert.setObject(1, id);
            insert.setString(2, "uid-" + id);
            insert.setString(3, id + "@example.ma");
            insert.setString(4, "Migration " + id);
            insert.setString(5, avatarUrl);
            insert.executeUpdate();
        }
    }

    private static void update(Connection connection, String sql, Object... parameters) throws SQLException {
        try (var update = connection.prepareStatement(sql)) {
            for (int i = 0; i < parameters.length; i++) {
                update.setObject(i + 1, parameters[i]);
            }
            update.executeUpdate();
        }
    }

    private static String storageKey(Connection connection, UUID id) throws SQLException {
        return column(connection, "avatar_storage_key", id);
    }

    private static String avatarUrl(Connection connection, UUID id) throws SQLException {
        return column(connection, "avatar_url", id);
    }

    private static String column(Connection connection, String column, UUID id) throws SQLException {
        try (var select = connection.prepareStatement("SELECT " + column + " FROM users WHERE id = ?")) {
            select.setObject(1, id);
            try (var rows = select.executeQuery()) {
                assertThat(rows.next()).isTrue();
                return rows.getString(1);
            }
        }
    }
}
