#!/usr/bin/env bash
set -euo pipefail

# Offline proof for the same stdin-only psql variable flow used by the ECS
# bootstrap task. The throwaway PostGIS image has no TLS certificate, so the
# local client deliberately uses the container's Unix socket; production
# requires TLS over the RDS network connection.
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
sql_file="$root_dir/infra/terraform/production/sql/bootstrap.sql"
container="dari-bootstrap-proof-$$"
superuser_password="bootstrap-superuser-proof"
master_password="bootstrap-master-proof"
role_password="dari role's proof"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$container" \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD="$superuser_password" \
  -e POSTGRES_DB=postgres \
  postgis/postgis:16-3.4 >/dev/null

until docker exec "$container" pg_isready -U postgres -d postgres >/dev/null 2>&1; do
  sleep 1
done

# RDS lets its rds_superuser install allow-listed extensions but is not a
# PostgreSQL superuser. Install them in template1 as the image superuser so a
# database created by the non-superuser master has the same extension surface.
docker exec -e PGPASSWORD="$superuser_password" "$container" \
  psql -U postgres -d template1 --set=ON_ERROR_STOP=1 \
  -c 'CREATE EXTENSION postgis; CREATE EXTENSION pgcrypto;' >/dev/null
docker exec -e PGPASSWORD="$superuser_password" "$container" \
  psql -U postgres -d postgres --set=ON_ERROR_STOP=1 \
  -c "CREATE ROLE rds_master LOGIN CREATEROLE CREATEDB PASSWORD '$master_password';" >/dev/null

# This is the old bootstrap form. It must fail: CREATEROLE and CREATEDB do not
# allow a non-superuser to assign a database to a role it cannot SET ROLE to.
docker exec -e PGPASSWORD="$master_password" "$container" \
  psql -U rds_master -d postgres --set=ON_ERROR_STOP=1 \
  -c 'CREATE ROLE old_dari LOGIN;' >/dev/null
docker exec -e PGPASSWORD="$master_password" "$container" \
  psql -U rds_master -d postgres --set=ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE old_dari OWNER old_dari;' >/dev/null 2>&1 && {
    echo 'Old bootstrap unexpectedly succeeded.' >&2
    exit 1
  }
docker exec -e PGPASSWORD="$master_password" "$container" \
  psql -U rds_master -d postgres --set=ON_ERROR_STOP=1 \
  -c 'DROP ROLE old_dari;' >/dev/null
echo 'Old bootstrap owner assignment failed for the non-superuser master as expected.'

run_bootstrap() {
  cat "$sql_file" | docker exec -i -e PGPASSWORD="$master_password" -e DARI_ROLE_PASSWORD="$role_password" "$container" \
    psql -U rds_master -d postgres --set=ON_ERROR_STOP=1
}

run_bootstrap
run_bootstrap

docker exec -e PGPASSWORD="$role_password" "$container" \
  psql -U dari -d dari --set=ON_ERROR_STOP=1 \
  -c 'CREATE TABLE bootstrap_flyway_privilege_check (id integer); DROP TABLE bootstrap_flyway_privilege_check;' >/dev/null

echo "Bootstrap proof passed twice with a password containing a space and quote; the dari role can run Flyway-style DDL."
