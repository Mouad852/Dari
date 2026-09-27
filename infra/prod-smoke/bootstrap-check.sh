#!/usr/bin/env bash
set -euo pipefail

# Offline proof for the same stdin-only psql variable flow used by the ECS
# bootstrap task. The throwaway PostGIS image has no TLS certificate, so the
# local client deliberately uses the container's Unix socket; production
# requires TLS over the RDS network connection.
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
sql_file="$root_dir/infra/terraform/production/sql/bootstrap.sql"
container="dari-bootstrap-proof-$$"
master_password="bootstrap-master-proof"
role_password="dari-role-proof"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$container" \
  -e POSTGRES_USER=bootstrap \
  -e POSTGRES_PASSWORD="$master_password" \
  -e POSTGRES_DB=postgres \
  postgis/postgis:16-3.4 >/dev/null

until docker exec "$container" pg_isready -U bootstrap -d postgres >/dev/null 2>&1; do
  sleep 1
done

run_bootstrap() {
  {
    printf '\\set dari_password %s\n' "$role_password"
    cat "$sql_file"
  } | docker exec -i -e PGPASSWORD="$master_password" "$container" \
    psql -U bootstrap -d postgres --set=ON_ERROR_STOP=1
}

run_bootstrap
run_bootstrap

docker exec -e PGPASSWORD="$role_password" "$container" \
  psql -U dari -d dari --set=ON_ERROR_STOP=1 \
  -c 'CREATE TABLE bootstrap_flyway_privilege_check (id integer); DROP TABLE bootstrap_flyway_privilege_check;' >/dev/null

echo 'Bootstrap proof passed twice; the dari role can run Flyway-style DDL.'
