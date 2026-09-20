-- PostgreSQL expands SELECT * when a view is created. The original V4 view
-- therefore did not acquire columns later added to listings by V8 and V18,
-- even though public search now filters on them. Recreate it with an explicit
-- current projection so schema changes are reviewed deliberately.
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
    expiry_warned_at
FROM listings
WHERE status = 'PUBLISHED'
  AND availability_state = 'AVAILABLE'
  AND deleted_at IS NULL;
