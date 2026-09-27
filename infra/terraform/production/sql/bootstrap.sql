-- Run once by the owner as the RDS master user, before the API starts.
-- Passwords are intentionally omitted; set the role password out of band and
-- put the same value in the POSTGRES_PASSWORD SSM parameter.
-- RDS is provisioned without db_name so this owner-run script can create it.
CREATE ROLE dari LOGIN;
CREATE DATABASE dari OWNER dari;
\connect dari
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
GRANT CONNECT ON DATABASE dari TO dari;
