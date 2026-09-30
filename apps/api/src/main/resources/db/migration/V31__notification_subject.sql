-- Each notification email gets its own subject ("Votre annonce « … » a été
-- refusée") instead of "Notification Dari" for everything (audit P1-10).
-- Written at enqueue time, like the body, because the listing title it names
-- is known there. Nullable: rows queued before this migration keep the
-- generic subject the sender falls back to.
ALTER TABLE notification_outbox ADD COLUMN subject TEXT;
