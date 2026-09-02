-- Phase 06: moderation and reporting.
CREATE TYPE report_target AS ENUM ('LISTING', 'USER');
CREATE TYPE report_reason AS ENUM (
    'FAKE_LISTING',
    'MISLEADING_PRICE',
    'UNAUTHORISED_BROKER',
    'INAPPROPRIATE_BEHAVIOR',
    'DISCRIMINATION',
    'SUSPECTED_SCAM',
    'OTHER'
);
CREATE TYPE report_status AS ENUM ('PENDING', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED');

ALTER TABLE listings
    ADD COLUMN auto_flagged BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE reports (
    id          UUID PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES users(id),
    target_type report_target NOT NULL,
    target_id   UUID NOT NULL,
    reason      report_reason NOT NULL,
    details     TEXT,
    status      report_status NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_reports_one_pending
    ON reports (reporter_id, target_type, target_id)
    WHERE status = 'PENDING';

CREATE INDEX idx_reports_target ON reports (target_type, target_id, created_at DESC);
CREATE INDEX idx_reports_queue ON reports (status, created_at) WHERE status = 'PENDING';

CREATE TABLE banned_identities (
    id          UUID PRIMARY KEY,
    email_lower TEXT UNIQUE,
    phone       TEXT UNIQUE,
    user_id     UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_actions (
    id          UUID PRIMARY KEY,
    admin_id    UUID NOT NULL REFERENCES users(id),
    action      TEXT NOT NULL,
    target_type report_target NOT NULL,
    target_id   UUID NOT NULL,
    reason      TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_actions_target ON admin_actions (target_type, target_id, created_at DESC);
