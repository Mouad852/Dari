ALTER TABLE listings
    ADD COLUMN expiry_warned_at TIMESTAMPTZ;

CREATE INDEX idx_listings_expiry
    ON listings (status, updated_at)
    WHERE deleted_at IS NULL AND expiry_warned_at IS NULL;
