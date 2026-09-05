ALTER TABLE notification_outbox
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN locked_at TIMESTAMPTZ,
    ADD COLUMN sent_at TIMESTAMPTZ,
    ADD COLUMN last_error TEXT;

ALTER TABLE notification_outbox
    ADD CONSTRAINT notification_outbox_status_check
    CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'DEAD'));

CREATE INDEX idx_notification_outbox_delivery
    ON notification_outbox (status, next_attempt_at, created_at, id);
