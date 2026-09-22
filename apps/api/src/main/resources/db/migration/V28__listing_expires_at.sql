-- An explicit end of life for a published listing.
--
-- Expiry used to be "updated_at older than 60 days", but updated_at is a
-- row-audit column that every write bumps, the expiry warning included. A
-- warned listing therefore restarted its own clock and could never expire.
-- expires_at is set when a moderator approves a listing (PENDING_REVIEW ->
-- PUBLISHED, which covers first publication and re-approval after an edit or
-- a renewal) and nothing else moves it.
ALTER TABLE listings ADD COLUMN expires_at TIMESTAMPTZ;

-- Existing listings get a fresh window from the deploy, not updated_at + 60
-- days. Deriving it from updated_at would expire nearly every live listing on
-- the first nightly run, including every one the old job had already warned,
-- and email all their owners at once. 60 days = dari.listing.expiry-days.
--
-- SUSPENDED listings whose suspension would restore them to PUBLISHED get one
-- too (a NULL prior_status restores to PUBLISHED), since restoring never sets
-- expires_at. Their expiry_warned_at is cleared with the rest, so each owner
-- is warned again before the new date.
UPDATE listings
SET expires_at = now() + interval '60 days',
    expiry_warned_at = NULL
WHERE deleted_at IS NULL
  AND (status = 'PUBLISHED'
       OR (status = 'SUSPENDED' AND COALESCE(prior_status, 'PUBLISHED') = 'PUBLISHED'));

-- Search maps published_listings rows onto the Listing entity, so the view
-- needs the column too (V25 explains why it has an explicit projection).
-- CREATE OR REPLACE may only append, which is also what keeps it safe for the
-- previous release: its entity ignores a column it does not map.
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
    expires_at
FROM listings
WHERE status = 'PUBLISHED'
  AND availability_state = 'AVAILABLE'
  AND deleted_at IS NULL;

-- The nightly job's predicate, partial in the style of idx_listings_searchable:
-- only live published listings are ever candidates. V18's idx_listings_expiry
-- on (status, updated_at) serves the previous release's job and stays until
-- the contract step drops it.
CREATE INDEX idx_listings_expires_at
    ON listings (expires_at)
    WHERE status = 'PUBLISHED'
      AND deleted_at IS NULL;
