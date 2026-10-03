-- Which version of the terms and privacy notice a person accepted at sign-up,
-- and when (owner decision P1-15). The version is the legal pages' own
-- DARI_LEGAL_VERSION as the client showed it. Nullable: accounts created
-- before this column have no recorded acceptance.
ALTER TABLE users ADD COLUMN terms_version TEXT;
ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMPTZ;
