-- psql reads this from DARI_ROLE_PASSWORD; it is never logged or interpolated
-- into a psql meta-command, so spaces and quotes are safe.
\getenv dari_password DARI_ROLE_PASSWORD
\if :{?dari_password}
\else
\echo 'DARI_ROLE_PASSWORD must be set.'
\quit
\endif
-- RDS is provisioned without db_name so this master-user script creates it.
SELECT format('CREATE ROLE dari LOGIN PASSWORD %L', :'dari_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dari')
\gexec
SELECT format('ALTER ROLE dari LOGIN PASSWORD %L', :'dari_password')
\gexec
-- An RDS master has CREATEROLE/CREATEDB but is not a PostgreSQL superuser.
-- Membership lets it assign the new database to its application owner.
GRANT dari TO CURRENT_USER;
SELECT 'CREATE DATABASE dari OWNER dari'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'dari')
\gexec
\connect dari
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Flyway V30 (neighborhood search). Trusted, so V30 could create it as the
-- database owner too; installing it here keeps every extension in one place.
CREATE EXTENSION IF NOT EXISTS unaccent;
GRANT CONNECT ON DATABASE dari TO dari;
