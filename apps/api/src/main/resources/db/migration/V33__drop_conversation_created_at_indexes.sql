-- Contract step of the inbox reorder (tracker 7.14; expand was V29). The inbox
-- has ordered by last_activity_at since 3.1b, served by the *_activity
-- indexes, and nothing orders conversations by created_at any more. No
-- release that did has been deployed. The *_activity indexes lead with the
-- same participant column, so per-participant lookups and the foreign keys
-- keep an index.
DROP INDEX IF EXISTS idx_conversations_participant_a;
DROP INDEX IF EXISTS idx_conversations_participant_b;
