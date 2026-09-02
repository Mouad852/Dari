-- Runs once, on an empty data volume, before Flyway.
-- Flyway's V1 repeats these idempotently so a CI database without this file
-- still works; this exists so a fresh `docker compose up` is usable immediately.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
