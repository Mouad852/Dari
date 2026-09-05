-- Removes everything infra/scripts/seed-load-test-data.sql created. Safe to run
-- even if the seed was never applied -- every statement matches only rows
-- clearly tagged as load-test fixtures.
--
-- Usage: psql "$DATABASE_URL" -f infra/scripts/cleanup-load-test-data.sql

DELETE FROM listing_amenities
WHERE listing_id IN (
    SELECT id FROM listings WHERE owner_id IN (
        SELECT id FROM users WHERE firebase_uid = 'load-test-owner'
    )
);

DELETE FROM listings
WHERE owner_id IN (
    SELECT id FROM users WHERE firebase_uid = 'load-test-owner'
);

DELETE FROM users WHERE firebase_uid = 'load-test-owner';
