CREATE UNIQUE INDEX idx_conversations_unlisted_pair
    ON conversations (participant_a_id, participant_b_id)
    WHERE listing_id IS NULL;
