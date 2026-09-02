-- Phase 02: public search must never touch the base table directly.
-- The view is the invariant: search can only see PUBLISHED + AVAILABLE + not deleted rows.
CREATE VIEW published_listings AS
SELECT *
FROM listings
WHERE status = 'PUBLISHED'
  AND availability_state = 'AVAILABLE'
  AND deleted_at IS NULL;
