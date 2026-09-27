-- Standard input supplies psql variable `dari_password`; it is never logged.
-- RDS is provisioned without db_name so this master-user script creates it.
SELECT format('CREATE ROLE dari LOGIN PASSWORD %L', :'dari_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dari')
\gexec
SELECT format('ALTER ROLE dari LOGIN PASSWORD %L', :'dari_password')
\gexec
SELECT 'CREATE DATABASE dari OWNER dari'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'dari')
\gexec
\connect dari
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
GRANT CONNECT ON DATABASE dari TO dari;
