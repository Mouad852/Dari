CREATE TYPE property_type AS ENUM ('APARTMENT', 'HOUSE', 'STUDIO');
CREATE TYPE room_type AS ENUM ('PRIVATE', 'SHARED');
CREATE TYPE room_furnishing AS ENUM ('FULLY_FURNISHED', 'PARTIALLY_FURNISHED', 'UNFURNISHED');
CREATE TYPE charge_inclusion AS ENUM ('INCLUDED', 'NOT_INCLUDED', 'NA');

ALTER TABLE listings
    ADD COLUMN description TEXT,
    ADD COLUMN price_deposit NUMERIC(10,2) CHECK (price_deposit >= 0),
    ADD COLUMN wifi_included charge_inclusion NOT NULL DEFAULT 'NA',
    ADD COLUMN electricity_included charge_inclusion NOT NULL DEFAULT 'NA',
    ADD COLUMN water_included charge_inclusion NOT NULL DEFAULT 'NA',
    ADD COLUMN property_type property_type,
    ADD COLUMN num_bedrooms SMALLINT CHECK (num_bedrooms BETWEEN 0 AND 20),
    ADD COLUMN num_bathrooms SMALLINT CHECK (num_bathrooms BETWEEN 0 AND 20),
    ADD COLUMN room_type room_type,
    ADD COLUMN room_furnishing room_furnishing,
    ADD COLUMN common_areas_furnished BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN current_roommates_count SMALLINT CHECK (current_roommates_count BETWEEN 0 AND 20),
    ADD COLUMN max_roommates SMALLINT CHECK (max_roommates BETWEEN 1 AND 20),
    ADD COLUMN available_from DATE,
    ADD COLUMN min_stay_months SMALLINT CHECK (min_stay_months BETWEEN 1 AND 36),
    ADD COLUMN rejection_reason TEXT;
