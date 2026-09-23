#!/usr/bin/env bash
# End-to-end check of the backup path, for CI and for a local run of the same
# gate: build a throwaway PostGIS with the real schema and the 50,000-listing
# load-test fixture, take a backup with backup.sh into a local directory,
# restore it with restore-drill.sh, and require the restored database to match
# the source: users, listings, published_listings, flyway_schema_history, and
# the drill's ST_DWithin query.
#
# Nothing here reaches AWS or any existing database. The source container, its
# network and the backup directory are created here and removed on exit.
#
#   bash infra/scripts/backup-restore-check.sh
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
pg_image=${CHECK_PG_IMAGE:-postgis/postgis:16-3.4}
# The Flyway version Spring Boot manages for the API (spring-boot 3.5.6).
flyway_image=${CHECK_FLYWAY_IMAGE:-flyway/flyway:11.7.2}

fail() {
    printf 'BACKUP/RESTORE CHECK FAILED: %s\n' "$1" >&2
    exit 1
}

host_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
export MSYS_NO_PATHCONV=1

suffix="$$-$(date +%s)"
network="dari-backup-check-$suffix"
db="dari-backup-check-db-$suffix"
# Outside the repository: backup.sh refuses a directory inside a git work tree.
work=$(mktemp -d)
cleanup() {
    docker rm -f -v "$db" >/dev/null 2>&1 || true
    docker network rm "$network" >/dev/null 2>&1 || true
    rm -rf "$work"
}
trap cleanup EXIT

password=backup-check-local-only
docker network create "$network" >/dev/null
docker run -d --name "$db" --network "$network" \
    -e POSTGRES_DB=dari -e POSTGRES_USER=dari -e POSTGRES_PASSWORD="$password" \
    "$pg_image" >/dev/null || fail "could not start $pg_image"

in_db() { docker exec -i "$db" psql -X -q -U dari -d dari -v ON_ERROR_STOP=1 "$@"; }
scalar() { in_db -tAc "$1"; }

ready=
for _ in $(seq 1 60); do
    if docker exec "$db" pg_isready -U dari -d dari >/dev/null 2>&1 \
       && [ "$(scalar "SELECT count(*) FROM pg_extension WHERE extname = 'postgis'" 2>/dev/null)" = 1 ]; then
        ready=yes
        break
    fi
    sleep 2
done
[ -n "$ready" ] || fail "PostGIS did not finish initialising"
sleep 3
docker exec "$db" pg_isready -U dari -d dari >/dev/null 2>&1 || fail "PostGIS restarted unexpectedly"

echo "== migrate ($flyway_image)"
docker run --rm --network "$network" \
    -v "$(host_path "$root/apps/api/src/main/resources/db/migration"):/flyway/sql:ro" \
    "$flyway_image" -url="jdbc:postgresql://$db:5432/dari" -user=dari -password="$password" \
    -locations=filesystem:/flyway/sql migrate >/dev/null || fail "flyway migrate failed"

echo "== seed (infra/scripts/seed-load-test-data.sql)"
in_db < "$here/seed-load-test-data.sql" >/dev/null || fail "seeding failed"

near_rabat_sql="SELECT count(*) FROM listings WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(-6.8498, 33.9716), 4326)::geography, 50000)"
declare -A source
source[flyway]=$(scalar "SELECT count(*) FROM flyway_schema_history")
source[users]=$(scalar "SELECT count(*) FROM users")
source[listings]=$(scalar "SELECT count(*) FROM listings")
source[published]=$(scalar "SELECT count(*) FROM published_listings")
source[near_rabat]=$(scalar "$near_rabat_sql")
[ "${source[published]}" -ge 50000 ] || fail "the fixture did not seed: ${source[published]} published listings"
[ "${source[near_rabat]}" -gt 0 ] || fail "no seeded listing near Rabat; the ST_DWithin comparison would prove nothing"

echo "== backup (infra/scripts/backup.sh)"
mkdir -p "$work/backups"
(
    export PGHOST="$db" PGDATABASE=dari PGUSER=dari PGPASSWORD="$password"
    export BACKUP_DIR="$work/backups" BACKUP_PG_IMAGE="$pg_image" BACKUP_DOCKER_NETWORK="$network"
    bash "$here/backup.sh"
) || fail "backup.sh failed"
archives=("$work"/backups/*.dump)
[ "${#archives[@]}" -eq 1 ] && [ -f "${archives[0]}" ] || fail "expected exactly one archive in the backup directory"

echo "== restore drill (infra/scripts/restore-drill.sh)"
bash "$here/restore-drill.sh" "${archives[0]}" | tee "$work/drill.out" || fail "restore-drill.sh failed"

declare -A restored
restored[flyway]=$(awk '$1 == "flyway_schema_history" { print $2 }' "$work/drill.out")
restored[users]=$(awk '$1 == "users" { print $2 }' "$work/drill.out")
restored[listings]=$(awk '$1 == "listings" { print $2 }' "$work/drill.out")
restored[published]=$(awk '$1 == "published_listings" { print $2 }' "$work/drill.out")
restored[near_rabat]=$(awk '/^  ST_DWithin 50 km of Rabat/ { print $(NF - 1) }' "$work/drill.out")

echo
printf '%-24s %10s %10s  %s\n' CHECK SOURCE RESTORED VERDICT
mismatches=0
for check in flyway users listings published near_rabat; do
    verdict=match
    if [ -z "${restored[$check]}" ] || [ "${source[$check]}" != "${restored[$check]}" ]; then
        verdict=MISMATCH
        mismatches=$((mismatches + 1))
    fi
    printf '%-24s %10s %10s  %s\n' "$check" "${source[$check]}" "${restored[$check]:-?}" "$verdict"
done
[ "$mismatches" -eq 0 ] || fail "$mismatches check(s) differ between the source and the restored database"
echo "Backup/restore check passed: the restored database matches its source."
