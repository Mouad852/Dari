-- Phase 09: favorites. Composite key on (user, listing) makes a repeated
-- POST /favorites/{listingId} idempotent by construction, not by an
-- application-level check.
CREATE TABLE favorites (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, listing_id)
);

-- Keyset pagination: newest favorite first, per user.
CREATE INDEX idx_favorites_user_created
    ON favorites (user_id, created_at DESC, listing_id DESC);
