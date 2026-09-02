-- Indexes for the sorts that became real in phase 07.
--
-- Until now `sort` was parsed and discarded on non-radius searches, so every
-- query ordered by created_at and idx_listings_searchable covered all of them.
-- With price and recently-updated actually ordering, two gaps showed up under
-- EXPLAIN ANALYZE against 50k seeded listings:
--
--   * recently-updated had no index at all. It bitmap-scanned every listing in
--     the city (12,500 rows for Rabat) and top-N heapsorted them: 21.6 ms for a
--     single page, growing linearly with the city.
--   * the price index stopped at price_rent, so the (price_rent, id) keyset
--     tiebreaker needed an incremental sort on top of the index scan.
--
-- Both partial, matching idx_listings_searchable: the public search invariant is
-- status = PUBLISHED AND availability_state = AVAILABLE AND deleted_at IS NULL,
-- and keeping it in the predicate keeps these indexes small and unusable by any
-- query that forgets it.

CREATE INDEX idx_listings_searchable_updated
    ON listings (city, updated_at DESC, id DESC)
    WHERE status = 'PUBLISHED'
      AND availability_state = 'AVAILABLE'
      AND deleted_at IS NULL;

-- Replaces the (city, price_rent) index. Adding id lets a price page resume
-- from its keyset cursor straight off the index, in both directions: ascending
-- scans forward, descending scans backward.
DROP INDEX IF EXISTS idx_listings_searchable_price;

CREATE INDEX idx_listings_searchable_price
    ON listings (city, price_rent, id)
    WHERE status = 'PUBLISHED'
      AND availability_state = 'AVAILABLE'
      AND deleted_at IS NULL;
