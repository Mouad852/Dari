CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    listing_id UUID REFERENCES listings(id),
    participant_a_id UUID NOT NULL REFERENCES users(id),
    participant_b_id UUID NOT NULL REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (participant_a_id <> participant_b_id)
);

CREATE INDEX idx_conversations_participant_a
    ON conversations (participant_a_id, created_at DESC, id DESC);

CREATE INDEX idx_conversations_participant_b
    ON conversations (participant_b_id, created_at DESC, id DESC);

CREATE UNIQUE INDEX idx_conversations_listing_pair
    ON conversations (listing_id, participant_a_id, participant_b_id)
    WHERE listing_id IS NOT NULL;

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    sender_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL CHECK (length(trim(body)) > 0),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CHECK (length(body) <= 4000)
);

CREATE INDEX idx_messages_conversation_sent
    ON messages (conversation_id, sent_at ASC, id ASC);

CREATE INDEX idx_messages_unread
    ON messages (conversation_id, sender_id, read_at)
    WHERE deleted_at IS NULL AND read_at IS NULL;
