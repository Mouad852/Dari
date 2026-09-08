-- Per-room structure for a listing (design doc §3 `listing_rooms`), modelling
-- Moroccan apartment layouts explicitly ("2 chambres + salon") instead of
-- relying only on the denormalized num_bedrooms/num_bathrooms counts.
--
-- The enum is `listing_room_type`, not `room_type`: V8 already took that name
-- for the listing-level PRIVATE/SHARED distinction, which answers a different
-- question (is the offered room private) than this one (what kind of room is
-- this physically).
CREATE TYPE listing_room_type AS ENUM ('BEDROOM', 'SALON', 'KITCHEN', 'BATHROOM', 'TERRACE', 'STORAGE');

CREATE TABLE listing_rooms (
    id          UUID PRIMARY KEY,
    listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    room_type   listing_room_type NOT NULL,
    -- Separate from room_type on purpose: a SALON can be the room actually
    -- offered to a roommate, which is the edge case this table exists for.
    is_rentable BOOLEAN NOT NULL DEFAULT false,
    is_shared   BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_rooms_listing_id ON listing_rooms (listing_id);
