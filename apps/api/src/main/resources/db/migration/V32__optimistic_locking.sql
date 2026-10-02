-- Optimistic locking (audit P2-2). A write built on a stale read used to win
-- silently: an owner's "chambre trouvée" could save PUBLISHED over the
-- SUSPENDED a moderator had set a moment earlier. Hibernate now checks and
-- bumps this column on every entity update, and the API answers 409.
ALTER TABLE listings ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

-- Search maps published_listings rows onto the Listing entity, so the view
-- needs the column too (see V28). CREATE OR REPLACE may only append.
CREATE OR REPLACE VIEW published_listings AS
SELECT
    id,
    owner_id,
    title,
    city,
    neighborhood,
    latitude,
    longitude,
    location,
    price_rent,
    status,
    availability_state,
    prior_status,
    deleted_at,
    created_at,
    updated_at,
    description,
    price_deposit,
    wifi_included,
    electricity_included,
    water_included,
    property_type,
    num_bedrooms,
    num_bathrooms,
    room_type,
    room_furnishing,
    common_areas_furnished,
    current_roommates_count,
    max_roommates,
    available_from,
    min_stay_months,
    rejection_reason,
    auto_flagged,
    expiry_warned_at,
    expires_at,
    version
FROM listings
WHERE status = 'PUBLISHED'
  AND availability_state = 'AVAILABLE'
  AND deleted_at IS NULL;
