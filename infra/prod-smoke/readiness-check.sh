#!/usr/bin/env bash
# Starts the API image with the production profile against a throwaway PostGIS
# and requires /actuator/health/readiness to answer UP. Flyway builds the whole
# schema on the way, so UP also means every migration applied to an empty
# database under the production configuration contract.
#
# Readiness is readinessState + db (application.yml), so the database is the
# only dependency started. The environment is smoke.env, with two changes: the
# CloudWatch push is switched off, so nothing tries to reach AWS, and the
# Firebase key is whatever FIREBASE_SERVICE_ACCOUNT_FILE names (CI passes a
# throwaway one, see throwaway-service-account.sh).
#
# No port is published; the probe runs inside the API container. Everything
# started here has a unique name and is removed on exit, pass or fail.
#
#   docker build -t dari-api:ci apps/api
#   SMOKE_IMAGE=dari-api:ci FIREBASE_SERVICE_ACCOUNT_FILE=/tmp/sa.json \
#     bash infra/prod-smoke/readiness-check.sh
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
image=${SMOKE_IMAGE:-dari-api:smoke}
db_image=${SMOKE_DB_IMAGE:-postgis/postgis:16-3.4}
key=${FIREBASE_SERVICE_ACCOUNT_FILE:-$root/infra/firebase/service-account.json}
timeout_s=${READINESS_TIMEOUT_SECONDS:-180}

fail() {
    printf 'READINESS CHECK FAILED: %s\n' "$1" >&2
    exit 1
}

[ -f "$key" ] || fail "no Firebase service-account file at $key"
host_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
export MSYS_NO_PATHCONV=1

suffix="$$-$(date +%s)"
network="dari-readiness-$suffix"
db="dari-readiness-db-$suffix"
api="dari-readiness-api-$suffix"
work=$(mktemp -d)
cleanup() {
    docker rm -f -v "$api" "$db" >/dev/null 2>&1 || true
    docker network rm "$network" >/dev/null 2>&1 || true
    rm -rf "$work"
}
trap cleanup EXIT

db_password=$(grep -E '^POSTGRES_PASSWORD=' "$here/smoke.env" | cut -d= -f2-)
sed '/^#/d; /^$/d' "$here/smoke.env" > "$work/api.env"
echo "DARI_METRICS_CLOUDWATCH_ENABLED=false" >> "$work/api.env"

docker network create "$network" >/dev/null
# DB_URL in smoke.env points at host "db".
docker run -d --name "$db" --network "$network" --network-alias db \
    -e POSTGRES_DB=dari -e POSTGRES_USER=dari -e POSTGRES_PASSWORD="$db_password" \
    "$db_image" >/dev/null || fail "could not start $db_image"

# The PostGIS image restarts the server after its init scripts; pg_isready
# alone can pass before that, and Flyway would then lose its connection.
ready=
for _ in $(seq 1 60); do
    if docker exec "$db" pg_isready -U dari -d dari >/dev/null 2>&1 \
       && [ "$(docker exec "$db" psql -X -tAq -U dari -d dari -c "SELECT count(*) FROM pg_extension WHERE extname = 'postgis'" 2>/dev/null)" = 1 ]; then
        ready=yes
        break
    fi
    sleep 2
done
[ -n "$ready" ] || fail "PostGIS did not finish initialising"
sleep 3
docker exec "$db" pg_isready -U dari -d dari >/dev/null 2>&1 || fail "PostGIS restarted unexpectedly"

docker run -d --name "$api" --network "$network" --env-file "$(host_path "$work/api.env")" \
    -v "$(host_path "$key"):/run/secrets/firebase-service-account.json:ro" \
    "$image" >/dev/null || fail "could not start $image"

started=$(date +%s)
body=
while :; do
    if [ "$(docker inspect -f '{{.State.Running}}' "$api" 2>/dev/null)" != true ]; then
        docker logs --tail 40 "$api" >&2 || true
        fail "the API container exited before becoming ready"
    fi
    body=$(docker exec "$api" curl -sS --max-time 5 http://localhost:8080/actuator/health/readiness 2>/dev/null || true)
    [ "$body" = '{"status":"UP"}' ] && break
    if [ $(( $(date +%s) - started )) -ge "$timeout_s" ]; then
        docker logs --tail 40 "$api" >&2 || true
        fail "readiness did not report UP within ${timeout_s}s (last answer: ${body:-none})"
    fi
    sleep 3
done

migrations=$(docker exec "$db" psql -X -tAq -U dari -d dari \
    -c "SELECT count(*) || ' applied, latest V' || max(version::int) FROM flyway_schema_history WHERE success AND version IS NOT NULL")
cat <<EOF
Readiness check passed.
  image       $image (SPRING_PROFILES_ACTIVE=production)
  database    $db_image, empty at start
  migrations  $migrations
  readiness   $body after $(( $(date +%s) - started )) s
EOF
