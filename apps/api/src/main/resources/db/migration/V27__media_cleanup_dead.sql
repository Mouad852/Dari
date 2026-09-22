-- A terminal state for keys the cleanup worker has given up on after
-- dari.media.cleanup-max-attempts failures. Without it a permanently
-- undeletable key was retried forever, and nothing distinguished it from a
-- key that is merely waiting out a storage outage.
--
-- DEAD does not mean deleted: the object may still exist. The key stays
-- revoked (the API keeps refusing to serve it), the dari.media.cleanup_depth
-- gauge counts it, and an operator inspects and re-queues it
-- (PRODUCTION_OPERATIONS.md, "Dead media cleanup rows").
--
-- Expand-safe: the previous release writes only PENDING and DELETED and only
-- ever loads PENDING rows. The constraint is V24's inline CHECK, which
-- PostgreSQL named media_cleanup_status_check.
ALTER TABLE media_cleanup DROP CONSTRAINT media_cleanup_status_check;
ALTER TABLE media_cleanup ADD CONSTRAINT media_cleanup_status_check
    CHECK (status IN ('PENDING', 'DELETED', 'DEAD'));
