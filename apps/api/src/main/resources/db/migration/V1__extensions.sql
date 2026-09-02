-- PostGIS is not optional infrastructure here; the search path is built on it.
CREATE EXTENSION IF NOT EXISTS postgis;

-- pgcrypto is not used for ids (those are application-side UUIDv7) but is
-- available for hashing where a stable non-reversible key is needed.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
