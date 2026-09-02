-- Phase 02: thin slice through the real risk.
-- Keep it narrow: title, city, neighborhood, price, coordinates, both lifecycle
-- dimensions and timestamps. Amenities / rooms / house rules / photos come later.
CREATE TYPE listing_status AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'PUBLISHED',
    'REJECTED',
    'SUSPENDED',
    'EXPIRED'
);

CREATE TYPE availability_state AS ENUM (
    'AVAILABLE',
    'ROOM_FOUND',
    'CLOSED'
);

CREATE TABLE listings (
    id                  UUID PRIMARY KEY,
    owner_id            UUID NOT NULL REFERENCES users(id),
    title               TEXT NOT NULL,
    city                TEXT NOT NULL,
    neighborhood        TEXT NOT NULL,
    latitude            DOUBLE PRECISION NOT NULL,
    longitude           DOUBLE PRECISION NOT NULL,

    -- Generated geography. This is the one source of truth for search; it cannot
    -- drift from lat/lng and it keeps the spatial index tied to the actual values.
    location            geography(Point, 4326) GENERATED ALWAYS AS (
                            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                        ) STORED,

    price_rent          NUMERIC(10,2) NOT NULL CHECK (price_rent >= 0),
    status              listing_status NOT NULL DEFAULT 'DRAFT',
    availability_state  availability_state NOT NULL DEFAULT 'AVAILABLE',

    -- Phase 06 restore path: if a dismissed auto-suspension is restored, the
    -- listing should come back to prior_status instead of blindly becoming
    -- PUBLISHED.
    prior_status        listing_status,

    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (latitude BETWEEN -90 AND 90),
    CHECK (longitude BETWEEN -180 AND 180)
);

-- Spatial index for radius search + distance ordering.
CREATE INDEX idx_listings_location ON listings USING GIST (location);

-- Public-search baseline: only approved + available + not deleted listings.
CREATE INDEX idx_listings_searchable
    ON listings (city, created_at DESC, id DESC)
    WHERE status = 'PUBLISHED'
      AND availability_state = 'AVAILABLE'
      AND deleted_at IS NULL;

-- Price filter on the same baseline.
CREATE INDEX idx_listings_searchable_price
    ON listings (city, price_rent)
    WHERE status = 'PUBLISHED'
      AND availability_state = 'AVAILABLE'
      AND deleted_at IS NULL;

-- Owner history.
CREATE INDEX idx_listings_owner
    ON listings (owner_id, created_at DESC, id DESC);

-- Baseline filter and distance sort both benefit from a compact index on the
-- public subset.
CREATE INDEX idx_listings_public_state
    ON listings (status, availability_state, deleted_at)
    WHERE status = 'PUBLISHED'
      AND availability_state = 'AVAILABLE'
      AND deleted_at IS NULL;
