-- Amenities reference data: normalized, so new amenities don't require migrations
CREATE TABLE amenities (
    code TEXT PRIMARY KEY,
    label_fr TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO amenities (code, label_fr, sort_order) VALUES
    ('wifi', 'Wi‑Fi', 1),
    ('parking', 'Parking', 2),
    ('balcony', 'Balcon', 3),
    ('kitchen', 'Cuisine', 4),
    ('laundry', 'Lave-linge', 5),
    ('air_conditioning', 'Climatisation', 6),
    ('elevator', 'Ascenseur', 7),
    ('near_transport', 'Proximité transport', 8),
    ('furnished', 'Meublé', 9),
    ('smoke_free', 'Sans fumée', 10)
ON CONFLICT DO NOTHING;

-- Join table: listings have many amenities, amenities belong to many listings
CREATE TABLE listing_amenities (
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    amenity_code TEXT NOT NULL REFERENCES amenities(code) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (listing_id, amenity_code)
);

-- Index for efficient amenity filtering in searches (the main query in phase 07)
CREATE INDEX idx_listing_amenities_code
    ON listing_amenities (amenity_code, listing_id);

-- House rules: one-to-one with listings, all nullable so unanswered listings drop out
-- of preference filters naturally (NULL does not equal false; silence is not a promise)
CREATE TABLE house_rules (
    listing_id UUID PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
    smoking_allowed BOOLEAN,
    pets_allowed BOOLEAN,
    guests_allowed BOOLEAN,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    other_rules TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update the published_listings view to include amenities and rules
-- This will be done in a separate migration to avoid circular dependencies
