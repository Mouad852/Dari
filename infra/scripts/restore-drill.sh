#!/usr/bin/env bash
# Restore drill: restore a pg_dump custom-format archive into a throwaway
# PostGIS 16 container and prove the result is a working Dari database.
#
# Bash port of restore-drill.ps1, for Linux operations hosts (and Git Bash).
# It keeps that script's rules:
#   - The archive path is the only input. It never connects to any application
#     database, only to the container it starts, which publishes no port.
#   - The container has a unique name and is always removed, pass or fail.
#   - It waits for the PostGIS image's own initialisation to finish before
#     restoring: pg_isready succeeds while the init scripts are still running,
#     and a restore that races them can have the server restart under it.
#   - It drops the extensions the image preinstalls, so the archive recreates
#     the source database's exact extension state.
# and adds the checks from docs/PRODUCTION_OPERATIONS.md: row counts for users,
# listings and flyway_schema_history, the published_listings view, one
# ST_DWithin query, postgis_full_version(), and elapsed seconds per phase. The
# first real drill's total is the measured RTO for a logical restore.
#
#   infra/scripts/restore-drill.sh /secure/backups/dari-dari-20260922T020000Z.dump
#
# If <archive>.sha256 exists (backup.sh writes it) the archive must match it.
# Exits non-zero with a message naming the failed step.
set -euo pipefail

IMAGE=${RESTORE_DRILL_IMAGE:-postgis/postgis:16-3.4}
DB=dari_restore
DB_USER=dari_restore

fail() {
    printf 'RESTORE DRILL FAILED: %s\n' "$1" >&2
    exit 1
}

[ $# -eq 1 ] || fail "usage: $0 <pg_dump custom-format archive>"
archive=$1
[ -f "$archive" ] || fail "archive not found: $archive"
[ -s "$archive" ] || fail "archive is empty: $archive"
command -v docker >/dev/null 2>&1 || fail "docker is not on PATH"

# Git Bash rewrites arguments that look like POSIX paths (/tmp/...) into
# Windows paths before docker sees them. Nothing here passes a host path to
# docker: the archive travels over stdin.
export MSYS_NO_PATHCONV=1

sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
    else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

now() { printf '%s' "${EPOCHREALTIME:-$(date +%s)}"; }
elapsed() { awk -v a="$1" -v b="$2" 'BEGIN { printf "%.1f", b - a }'; }
phase_started=
phase_name=
phase_report=
begin() { phase_name=$1; phase_started=$(now); }
end() {
    local seconds
    seconds=$(elapsed "$phase_started" "$(now)")
    phase_report="${phase_report}$(printf '  %-26s %6s s' "$phase_name" "$seconds")
"
}

container="dari-restore-drill-$$-$(date +%s)"
# -v: the image declares its data directory a volume, and without it every
# drill would leave an anonymous volume holding a full copy of the restored data.
cleanup() { docker rm -f -v "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
trap 'fail "interrupted"' INT TERM

in_db() { docker exec -i "$container" psql -X -q -U "$DB_USER" -d "$DB" -v ON_ERROR_STOP=1 "$@"; }
scalar() { in_db -tAc "$1"; }

drill_started=$(now)
archive_bytes=$(wc -c < "$archive" | tr -d ' ')
archive_sha256=$(sha256_of "$archive")

begin "verify checksum"
if [ -f "$archive.sha256" ]; then
    expected=$(cut -d' ' -f1 < "$archive.sha256")
    [ "$expected" = "$archive_sha256" ] || fail "checksum mismatch: $archive does not match $archive.sha256 (truncated or altered)"
    checksum_note="matches $archive.sha256"
else
    checksum_note="no .sha256 alongside; not checked"
fi
end

begin "start container"
docker run -d --name "$container" \
    -e POSTGRES_DB="$DB" -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD=restore-drill-local-only \
    "$IMAGE" >/dev/null || fail "could not start $IMAGE"
end

begin "wait for image init"
ready=
for _ in $(seq 1 60); do
    if docker exec "$container" pg_isready -U "$DB_USER" -d "$DB" >/dev/null 2>&1 \
       && [ "$(scalar "SELECT count(*) FROM pg_extension WHERE extname IN ('fuzzystrmatch', 'postgis', 'postgis_tiger_geocoder', 'postgis_topology')" 2>/dev/null)" = 4 ]; then
        ready=yes
        break
    fi
    sleep 2
done
[ -n "$ready" ] || fail "the PostGIS image did not finish initialising"
# The init scripts end with a server restart; make sure it is back and stays up.
sleep 3
docker exec "$container" pg_isready -U "$DB_USER" -d "$DB" >/dev/null 2>&1 \
    || fail "the container restarted unexpectedly during initialisation"
end

begin "copy archive in"
docker exec -i "$container" sh -c 'cat > /tmp/restore.dump' < "$archive" || fail "could not copy the archive into the container"
[ "$(docker exec "$container" sha256sum /tmp/restore.dump | cut -d' ' -f1)" = "$archive_sha256" ] \
    || fail "the archive changed while being copied into the container"
docker exec "$container" pg_restore --list /tmp/restore.dump >/dev/null 2>&1 \
    || fail "pg_restore cannot read the archive's table of contents (not a custom-format dump, or truncated)"
end

begin "prepare database"
in_db -c "DROP EXTENSION IF EXISTS postgis_tiger_geocoder CASCADE; DROP EXTENSION IF EXISTS postgis_topology CASCADE; DROP EXTENSION IF EXISTS postgis CASCADE; DROP EXTENSION IF EXISTS fuzzystrmatch CASCADE; DROP SCHEMA IF EXISTS tiger CASCADE; DROP SCHEMA IF EXISTS tiger_data CASCADE; DROP SCHEMA IF EXISTS topology CASCADE;" \
    || fail "could not remove the image's preinstalled extensions"
end

begin "pg_restore"
# --no-owner / --no-privileges: the drill database has none of the source's
# roles (dari, rds_superuser, ...). This proves the data and schema; the
# production restore path for RDS is a snapshot or PITR, not this.
restore_log=$(docker exec "$container" pg_restore -U "$DB_USER" -d "$DB" --no-owner --no-privileges \
    --exit-on-error /tmp/restore.dump 2>&1) || { printf '%s\n' "$restore_log" | tail -5 >&2; fail "pg_restore failed"; }
end

begin "checks"
flyway_rows=$(scalar "SELECT count(*) FROM flyway_schema_history") || fail "flyway_schema_history is missing: not a Dari database"
[ "$flyway_rows" -gt 0 ] || fail "flyway_schema_history is empty"
failed_migrations=$(scalar "SELECT count(*) FROM flyway_schema_history WHERE NOT success")
[ "$failed_migrations" = 0 ] || fail "flyway_schema_history records $failed_migrations failed migration(s)"
schema_version=$(scalar "SELECT max(version::int) FROM flyway_schema_history WHERE success AND version IS NOT NULL")
users=$(scalar "SELECT count(*) FROM users") || fail "users table unreadable"
listings=$(scalar "SELECT count(*) FROM listings") || fail "listings table unreadable"
published=$(scalar "SELECT count(*) FROM published_listings") || fail "published_listings view unreadable"
# Exercises PostGIS and the listing geography column: everything within 50 km
# of central Rabat.
near_rabat=$(scalar "SELECT count(*) FROM listings WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(-6.8498, 33.9716), 4326)::geography, 50000)") \
    || fail "ST_DWithin query failed"
postgis=$(scalar "SELECT postgis_full_version()") || fail "postgis_full_version() failed"
case "$postgis" in POSTGIS=*) ;; *) fail "unexpected postgis_full_version(): $postgis" ;; esac
end

total=$(elapsed "$drill_started" "$(now)")
cat <<EOF
Restore drill passed: the archive restored into a disposable PostGIS container.
  archive                    $archive
  size                       $archive_bytes bytes
  sha256                     $archive_sha256 ($checksum_note)
  image                      $IMAGE
  flyway_schema_history      $flyway_rows rows, schema version $schema_version, 0 failed
  users                      $users rows
  listings                   $listings rows
  published_listings         $published rows
  ST_DWithin 50 km of Rabat  $near_rabat listings
  postgis_full_version()     ${postgis%% *} ...
Elapsed per phase:
${phase_report}  total                      $total s
EOF
