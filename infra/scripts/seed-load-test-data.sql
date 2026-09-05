-- Load-test fixture data for the search path (TODO.md Priority 1: "run realistic
-- search load tests and record acceptance thresholds"). Generates 50,000 published,
-- available listings spread across the four launch cities, with real neighborhood
-- names (from the V20 seed) and randomized amenities, property/room types, prices,
-- and timestamps -- enough variety to exercise every filter and sort combination
-- the search endpoint supports, not just the default unfiltered case.
--
-- Intended for a local or scratch database only. Run against production data.
-- Remove afterward with infra/scripts/cleanup-load-test-data.sql -- these rows are
-- clearly tagged (title prefix, a dedicated owner) precisely so they can be found
-- and deleted without touching real data.
--
-- Usage: psql "$DATABASE_URL" -f infra/scripts/seed-load-test-data.sql

-- Postgres 14+'s Memoize node caches a parameterized LATERAL subquery's result
-- keyed by its correlation value, without regard for whether the subquery is
-- volatile. The neighborhood pick below is correlated only by city (four
-- distinct values across 50,000 rows), so without this, "ORDER BY random()
-- LIMIT 1" gets computed once per city and reused for every row that shares
-- it -- every listing in a city silently getting the same neighborhood. Caught
-- by checking distinct-neighborhood counts after the first run of this script,
-- not by inspection: the query reads as correct. A plain session-level SET, not
-- SET LOCAL -- there is no enclosing transaction block for LOCAL to scope itself
-- to, and psql runs every top-level statement in its own implicit transaction.
SET enable_memoize = off;

DO $$
DECLARE
    seed_owner_id UUID;
BEGIN
    SELECT id INTO seed_owner_id FROM users WHERE firebase_uid = 'load-test-owner';
    IF seed_owner_id IS NULL THEN
        INSERT INTO users (id, firebase_uid, email, email_verified, display_name)
        VALUES (gen_random_uuid(), 'load-test-owner', 'load-test-owner@dari.invalid', true, 'Load Test Owner')
        RETURNING id INTO seed_owner_id;
    END IF;

    INSERT INTO listings (
        id, owner_id, title, city, neighborhood, latitude, longitude,
        price_rent, status, availability_state,
        description, property_type, room_type, room_furnishing,
        wifi_included, electricity_included, water_included,
        num_bedrooms, num_bathrooms, common_areas_furnished,
        current_roommates_count, max_roommates, available_from, min_stay_months,
        created_at, updated_at
    )
    SELECT
        gen_random_uuid(),
        seed_owner_id,
        'Load test listing #' || s,
        c.city,
        n.name,
        c.lat + (random() - 0.5) * 0.08,
        c.lng + (random() - 0.5) * 0.08,
        (1500 + floor(random() * 4500))::numeric(10,2),
        'PUBLISHED', 'AVAILABLE',
        'Annonce générée pour un test de charge.',
        (ARRAY['APARTMENT', 'HOUSE', 'STUDIO']::property_type[])[1 + floor(random() * 3)],
        (ARRAY['PRIVATE', 'SHARED']::room_type[])[1 + floor(random() * 2)],
        (ARRAY['FULLY_FURNISHED', 'PARTIALLY_FURNISHED', 'UNFURNISHED']::room_furnishing[])[1 + floor(random() * 3)],
        (ARRAY['INCLUDED', 'NOT_INCLUDED', 'NA']::charge_inclusion[])[1 + floor(random() * 3)],
        (ARRAY['INCLUDED', 'NOT_INCLUDED', 'NA']::charge_inclusion[])[1 + floor(random() * 3)],
        (ARRAY['INCLUDED', 'NOT_INCLUDED', 'NA']::charge_inclusion[])[1 + floor(random() * 3)],
        (1 + floor(random() * 4))::smallint,
        (1 + floor(random() * 2))::smallint,
        (random() < 0.5),
        (0 + floor(random() * 3))::smallint,
        (2 + floor(random() * 3))::smallint,
        CURRENT_DATE + floor(random() * 60)::int,
        (1 + floor(random() * 12))::smallint,
        now() - (random() * interval '365 days'),
        now() - (random() * interval '365 days')
    FROM generate_series(1, 50000) AS s
    CROSS JOIN LATERAL (
        -- "WHERE s = s" looks pointless but is not: without a real reference to
        -- the outer row, Postgres has no LATERAL dependency to justify per-row
        -- evaluation and hoists this into a single subplan evaluated once for
        -- the whole query -- random() is volatile so it still runs, just once,
        -- and every row of the cross join silently gets the same pick. This bit
        -- during the first run of this script: every one of 50,000 rows landed
        -- in the same city. The trivial self-comparison on s is what forces a
        -- genuine per-row re-evaluation.
        SELECT * FROM (VALUES
            ('Rabat', 33.9716::double precision, -6.8498::double precision),
            ('Casablanca', 33.5731::double precision, -7.5898::double precision),
            ('Marrakech', 31.6295::double precision, -7.9811::double precision),
            ('Tanger', 35.7595::double precision, -5.834::double precision)
        ) AS t(city, lat, lng)
        WHERE s = s
        ORDER BY random()
        LIMIT 1
    ) c
    CROSS JOIN LATERAL (
        SELECT name FROM neighborhoods WHERE city = c.city ORDER BY random() LIMIT 1
    ) n;

    -- One to four random amenities per listing, so the AND-filter path (the
    -- correlated-count query rewritten in phase 07) has real data to scan.
    -- Same forced-correlation trick as above: the amenities table has nothing
    -- to do with listing_id, so without "WHERE l.id = l.id" every listing would
    -- get the exact same random amenity set instead of its own.
    INSERT INTO listing_amenities (listing_id, amenity_code, created_at)
    SELECT l.id, a.code, now()
    FROM listings l
    CROSS JOIN LATERAL (
        SELECT code FROM amenities WHERE l.id = l.id ORDER BY random() LIMIT (1 + floor(random() * 4))::int
    ) a
    WHERE l.owner_id = seed_owner_id
    ON CONFLICT DO NOTHING;
END $$;
