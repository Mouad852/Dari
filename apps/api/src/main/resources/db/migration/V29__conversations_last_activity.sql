-- When a conversation last saw a message, so the inbox can list the thread
-- with a new reply first instead of by creation date.
--
-- NOT NULL rather than a nullable "last message" time: a conversation with no
-- message yet sorts by when it was opened, and one plain column keeps the
-- inbox keyset a simple composite index instead of a coalesce() expression.
-- The database sets it (the default here, now() when a message is sent), so
-- every value comes from one clock.
ALTER TABLE conversations ADD COLUMN last_activity_at TIMESTAMPTZ;

UPDATE conversations c
SET last_activity_at = COALESCE(
        (SELECT max(m.sent_at) FROM messages m WHERE m.conversation_id = c.id),
        c.created_at);

ALTER TABLE conversations ALTER COLUMN last_activity_at SET DEFAULT now();
ALTER TABLE conversations ALTER COLUMN last_activity_at SET NOT NULL;

-- The inbox keyset, one per side of the canonical pair, as V10's
-- created_at indexes are. Those stay until the inbox query moves over.
CREATE INDEX idx_conversations_participant_a_activity
    ON conversations (participant_a_id, last_activity_at DESC, id DESC);

CREATE INDEX idx_conversations_participant_b_activity
    ON conversations (participant_b_id, last_activity_at DESC, id DESC);
