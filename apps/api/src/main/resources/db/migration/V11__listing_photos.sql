CREATE TABLE listing_photos (
    id            UUID PRIMARY KEY,
    listing_id    UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    storage_key   TEXT NOT NULL UNIQUE,
    mime_type     TEXT NOT NULL,
    width         INTEGER NOT NULL CHECK (width > 0),
    height        INTEGER NOT NULL CHECK (height > 0),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_cover      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_photos_listing_sort_order
    ON listing_photos (listing_id, sort_order, created_at);

CREATE UNIQUE INDEX idx_listing_photos_active_cover
    ON listing_photos (listing_id)
    WHERE is_cover = TRUE AND deleted_at IS NULL;
