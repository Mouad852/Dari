package ma.dari.api.messaging;

import ma.dari.api.support.ScratchDatabase;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V29 over conversations that already exist: each gets its latest message's
 * time as its last activity, or its creation time when it has no message.
 */
class ConversationActivityMigrationTest {

    @Test
    void v29BackfillsLastActivityFromMessagesOrCreation() throws Exception {
        try (ScratchDatabase db = ScratchDatabase.create("conversation_activity")) {
            db.flyway("28").migrate();

            Instant opened = Instant.now().minus(Duration.ofDays(10)).truncatedTo(ChronoUnit.MICROS);
            Instant lastReply = opened.plus(Duration.ofDays(3));
            // One pair per conversation: unlisted pairs are unique (V23).
            UUID first = UUID.randomUUID();
            UUID second = UUID.randomUUID();
            UUID third = UUID.randomUUID();
            UUID talked;
            UUID silent;
            try (Connection connection = db.connect()) {
                for (UUID user : new UUID[] {first, second, third}) {
                    execute(connection, "INSERT INTO users (id, firebase_uid, email, display_name) VALUES (?, ?, ?, ?)",
                            user, "uid-" + user, user + "@example.ma", "Migration User");
                }
                talked = conversation(connection, first, second, opened);
                message(connection, talked, first, opened.plus(Duration.ofDays(1)));
                message(connection, talked, second, lastReply);
                silent = conversation(connection, first, third, opened);
            }

            var result = db.flyway("29").migrate();
            assertThat(result.targetSchemaVersion).isEqualTo("29");

            try (Connection connection = db.connect()) {
                assertThat(lastActivity(connection, talked)).isEqualTo(lastReply);
                assertThat(lastActivity(connection, silent)).isEqualTo(opened);

                // New rows take the default, as the application's native insert relies on.
                UUID fresh = UUID.randomUUID();
                execute(connection, "INSERT INTO conversations (id, participant_a_id, participant_b_id) VALUES (?, ?, ?)",
                        fresh, second, third);
                assertThat(lastActivity(connection, fresh)).isNotNull();
            }
        }
    }

    private static UUID conversation(Connection connection, UUID a, UUID b, Instant createdAt) throws SQLException {
        UUID id = UUID.randomUUID();
        execute(connection, "INSERT INTO conversations (id, participant_a_id, participant_b_id, created_at) VALUES (?, ?, ?, ?)",
                id, a, b, Timestamp.from(createdAt));
        return id;
    }

    private static void message(Connection connection, UUID conversation, UUID sender, Instant sentAt) throws SQLException {
        execute(connection, "INSERT INTO messages (id, conversation_id, sender_id, body, sent_at) VALUES (?, ?, ?, 'Bonjour', ?)",
                UUID.randomUUID(), conversation, sender, Timestamp.from(sentAt));
    }

    private static Instant lastActivity(Connection connection, UUID conversation) throws SQLException {
        try (var select = connection.prepareStatement("SELECT last_activity_at FROM conversations WHERE id = ?")) {
            select.setObject(1, conversation);
            try (var rows = select.executeQuery()) {
                assertThat(rows.next()).isTrue();
                Timestamp value = rows.getTimestamp(1);
                return value == null ? null : value.toInstant();
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
