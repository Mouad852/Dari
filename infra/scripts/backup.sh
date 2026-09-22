#!/usr/bin/env bash
# Logical backup of one PostgreSQL database: pg_dump -Fc, verified before it
# is trusted. Its job in the release contract is the pre-deploy dump taken
# before migrations run (docs/PRODUCTION_OPERATIONS.md). Daily backups and
# point-in-time recovery are RDS automated backups, not this script.
#
# The target is given only by the standard libpq variables, and there are no
# defaults: nothing here names a development container or a production host.
#   PGHOST, PGDATABASE, PGUSER   required
#   PGPORT                       optional (5432)
#   PGPASSWORD or ~/.pgpass      the password; never printed
#   BACKUP_DIR                   required; must be outside any git work tree
#   BACKUP_MIN_BYTES             optional (4096); a smaller archive is a failure
#   BACKUP_PG_IMAGE              optional; run pg_dump/pg_restore from this image
#                                through Docker instead of local client tools
#   BACKUP_DOCKER_NETWORK        optional; the Docker network to reach PGHOST on
#
#   PGHOST=... PGDATABASE=dari PGUSER=... BACKUP_DIR=/secure/backups \
#     infra/scripts/backup.sh
#
# Writes <BACKUP_DIR>/dari-<database>-<UTC timestamp>.dump and a .dump.sha256
# beside it (sha256sum format), both readable by the operator only. The archive
# is accepted only if pg_restore can read its whole table of contents and it
# contains flyway_schema_history data. Uploading it to the offsite bucket is
# done on the AWS side and documented, not here.
set -euo pipefail

fail() {
    printf 'BACKUP FAILED: %s\n' "$1" >&2
    exit 1
}

for name in PGHOST PGDATABASE PGUSER BACKUP_DIR; do
    [ -n "${!name:-}" ] || fail "$name is not set"
done
min_bytes=${BACKUP_MIN_BYTES:-4096}
case "$min_bytes" in ''|*[!0-9]*) fail "BACKUP_MIN_BYTES must be a whole number of bytes" ;; esac

[ -d "$BACKUP_DIR" ] || fail "BACKUP_DIR does not exist: $BACKUP_DIR"
backup_dir=$(cd "$BACKUP_DIR" && pwd -P)
# A dump holds every user's personal data. It must never be one `git add`
# away from a commit, in this repository or any other.
if command -v git >/dev/null 2>&1 \
   && [ "$(git -C "$backup_dir" rev-parse --is-inside-work-tree 2>/dev/null || true)" = true ]; then
    fail "BACKUP_DIR is inside a git work tree ($(git -C "$backup_dir" rev-parse --show-toplevel)); choose a directory outside it"
fi
repo_root=$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd -P || true)
case "$backup_dir/" in
    "$repo_root"/*) [ -n "$repo_root" ] && fail "BACKUP_DIR is inside the repository ($repo_root)" ;;
esac

export MSYS_NO_PATHCONV=1
if [ -n "${BACKUP_PG_IMAGE:-}" ]; then
    command -v docker >/dev/null 2>&1 || fail "BACKUP_PG_IMAGE is set but docker is not on PATH"
    network_args=()
    [ -n "${BACKUP_DOCKER_NETWORK:-}" ] && network_args=(--network "$BACKUP_DOCKER_NETWORK")
    # -e NAME without a value passes the variable through from this
    # environment, so the password never appears on a command line.
    pg() { docker run --rm -i "${network_args[@]}" -e PGHOST -e PGPORT -e PGDATABASE -e PGUSER -e PGPASSWORD \
               "$BACKUP_PG_IMAGE" "$@"; }
    client="$BACKUP_PG_IMAGE (docker)"
else
    command -v pg_dump >/dev/null 2>&1 || fail "pg_dump is not on PATH (install the PostgreSQL 16 client, or set BACKUP_PG_IMAGE)"
    command -v pg_restore >/dev/null 2>&1 || fail "pg_restore is not on PATH"
    pg() { "$@"; }
    client=local
fi
export PGPORT=${PGPORT:-5432}

sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
    else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

stamp=$(date -u +%Y%m%dT%H%M%SZ)
name="dari-${PGDATABASE}-${stamp}.dump"
target="$backup_dir/$name"
partial="$target.partial"
[ -e "$target" ] && fail "$target already exists"
umask 077
trap 'rm -f "$partial" "$partial.toc"' EXIT

started=${EPOCHREALTIME:-$(date +%s)}
# The archive goes to stdout, so no path ever crosses into a container.
pg pg_dump --format=custom --no-password < /dev/null > "$partial" \
    || fail "pg_dump failed for database $PGDATABASE on $PGHOST:$PGPORT"

bytes=$(wc -c < "$partial" | tr -d ' ')
[ "$bytes" -ge "$min_bytes" ] || fail "archive is only $bytes bytes (BACKUP_MIN_BYTES=$min_bytes)"

pg pg_restore --list < "$partial" > "$partial.toc" 2>/dev/null \
    || fail "pg_restore cannot read the archive's table of contents"
grep -q 'TABLE DATA public flyway_schema_history' "$partial.toc" \
    || fail "the archive has no flyway_schema_history data: not a Dari database, or dumped without data"
entries=$(grep -c '^[0-9]' "$partial.toc" || true)

mv "$partial" "$target"
digest=$(sha256_of "$target")
printf '%s  %s\n' "$digest" "$name" > "$target.sha256"
finished=${EPOCHREALTIME:-$(date +%s)}

cat <<EOF
Backup written and verified.
  archive    $target
  size       $bytes bytes
  sha256     $digest (also in $name.sha256)
  contents   $entries table-of-contents entries, including flyway_schema_history data
  source     database $PGDATABASE on $PGHOST:$PGPORT as $PGUSER
  client     $client
  elapsed    $(awk -v a="$started" -v b="$finished" 'BEGIN { printf "%.1f", b - a }') s
Next: copy both files to the offsite backup bucket (see PRODUCTION_OPERATIONS.md),
then run infra/scripts/restore-drill.sh on the archive.
EOF
