-- The new-message email throttle (tracker 2.1a, owner decision P0-1) asks,
-- on every message sent, whether this recipient already had an email about
-- this conversation in the last 30 minutes. Without an index that is a scan
-- of the whole outbox, which only grows.
CREATE INDEX idx_notification_outbox_recipient_aggregate
    ON notification_outbox (recipient_id, aggregate_id, event_type, created_at DESC);
