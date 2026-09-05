CREATE TABLE notification_outbox (
    id              UUID PRIMARY KEY,
    event_type      TEXT NOT NULL,
    recipient_id    UUID NOT NULL REFERENCES users(id),
    aggregate_id    UUID,
    payload         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_outbox_created
    ON notification_outbox (created_at, id);
