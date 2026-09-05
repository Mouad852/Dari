# Production operations

This runbook covers the production PostgreSQL backup policy and the deployment
rollback procedure for Dari. It deliberately does not cover a Firestore mirror;
PostgreSQL remains the authoritative application store.

## Database backups

### Policy

- Take one encrypted custom-format `pg_dump` every day during the lowest-traffic
  window, using a dedicated backup role with read access to the Dari database.
- Upload the archive to an offsite object-storage bucket in a separate account
  or project. Do not keep the only copy on the API host, database host, or in
  the repository.
- Enable bucket versioning, server-side encryption with a managed key, and
  object-lock/immutability where the provider supports it. Restrict the backup
  prefix to the backup role and the small operations group.
- Keep daily backups for 35 days, weekly backups for 12 weeks, and monthly
  backups for 12 months. Delete expired objects through a lifecycle rule, not
  an ad-hoc shell command.
- Alert when a scheduled backup is missing, the upload fails, the archive is
  unexpectedly small, or the last restore verification is more than 7 days
  old. A successful `pg_dump` without an offsite upload is not a successful
  backup.

This policy targets an RPO of 24 hours. The restore procedure below is the
source of truth for the RTO estimate; measure it during the first production
restore drill and record the result rather than promising an untested number.

### Create and upload

Run from a trusted operations host. The destination and credentials are
provided by the deployment environment, never committed to the repository.

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$file = ".\dari-$stamp.dump"

docker exec dari-db pg_dump -U $env:POSTGRES_BACKUP_USER `
  -d $env:POSTGRES_DB -Fc -f "/tmp/dari-$stamp.dump"
docker cp "dari-db:/tmp/dari-$stamp.dump" $file

pg_restore --list $file | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Backup archive failed pg_restore validation" }

# Use the approved S3-compatible client or provider CLI here.
# Upload $file to the versioned, immutable offsite backup bucket.
```

After upload, verify the object exists, has the expected encryption and
retention metadata, and has a checksum matching the local archive. Remove the
temporary local archive after verification. Do not print database passwords or
cloud credentials in logs.

### Restore verification and disaster recovery

At least weekly, restore the newest backup into an isolated PostGIS 16
environment. The environment must not be reachable by the public API.

```powershell
docker run --name dari-db-restore-validation `
  -e POSTGRES_DB=dari -e POSTGRES_USER=dari `
  -e POSTGRES_PASSWORD=restore_validation `
  -d postgis/postgis:16-3.4

# Wait for the image init process to complete before restoring.
docker cp .\dari-backup.dump dari-db-restore-validation:/tmp/restore.dump
docker exec dari-db-restore-validation pg_restore -U dari -d dari `
  --no-owner --exit-on-error /tmp/restore.dump
docker exec dari-db-restore-validation psql -U dari -d dari `
  -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM users; SELECT count(*) FROM listings; SELECT count(*) FROM flyway_schema_history; SELECT postgis_full_version();"
docker rm -f dari-db-restore-validation
```

Record the archive timestamp, restore duration, row-count checks, PostGIS
version, and operator. If restore verification fails, page the on-call owner
and keep the previous known-good backup. Never test a restore against the
production database.

## Deployment and rollback

### Release contract

1. Build the API and web artifacts once and deploy immutable image/artifact
   identifiers. Do not rebuild a rollback release from a moving branch.
2. Record the release identifier, git commit, migration range, backup object,
   and deployment operator in the release log.
3. Take and verify a pre-deploy database backup for every production release.
4. Run Flyway migrations on startup, but only after the pre-deploy backup is
   available. Migrations must be backward-compatible with the previous release.
5. Use expand-then-contract for schema changes: add nullable columns/indexes,
   deploy code that can read both shapes, backfill, switch reads/writes, and
   remove old columns only in a later release.
6. Deploy the API, run health and smoke checks, then deploy the web artifact
   that targets the verified API release. Keep the previous API and web
   artifacts available until the release is accepted.

### Fast rollback

Use this path for elevated 5xx responses, failed health checks, broken
authentication, incorrect writes, or a migration that prevents the previous
application release from starting.

1. Stop the rollout and record the first failing timestamp and release id.
2. Route traffic to the previous immutable API and web artifacts.
3. Confirm `/actuator/health` and a read-only listing request, then verify
   authentication and one representative write in a non-production-safe
   manner agreed by the operator.
4. Inspect the migration and application logs. Do **not** run `flyway clean`,
   delete migration rows, or manually edit `flyway_schema_history`.
5. If the schema change is backward-compatible, leave it in place and open a
   follow-up migration. If it is destructive or data-corrupting, stop writes,
   preserve logs and the failed-release backup, and use the disaster-recovery
   restore procedure with an explicit incident decision.
6. Keep the failed release artifacts and backup; do not overwrite them while
   investigating. Re-enable traffic only after smoke checks and error rates
   return to the agreed baseline.

Rollback is an application artifact change, not an automatic database
rollback. Destructive schema changes require a separately rehearsed restore
plan and an explicit maintenance window.

### Post-rollback

Record the impact window, affected release and migration, backup used, data
loss (if any), checks performed, and next corrective migration. Re-run the API
test suite before the next release:

```powershell
cd apps/api
.\mvnw.cmd test
```

The production operator must also confirm that the next backup completed and
that the failed release remains available for diagnosis.

## Search load testing

`GET /listings` is, in its own controller comment, "the busiest and most
complex query in the system." This section records how it was load tested,
what that testing found, and the acceptance thresholds to check future
changes against.

### Method

1. Seed 50,000 published, available listings across the four launch cities
   with real neighborhood names, randomized property/room types, amenities,
   and prices: `infra/scripts/seed-load-test-data.sql`. Remove it afterward
   with `infra/scripts/cleanup-load-test-data.sql` — both scripts tag every
   row they touch (a dedicated `load-test-owner` user, a `Load test listing #`
   title prefix) so cleanup can never catch real data.
2. Start the API against that data with the search rate limit raised — the
   120/minute default exists to stop abuse, not to cap a deliberate
   benchmark of the query/app path, which is a different concern already
   covered by `RateLimitInterceptorTest`:
   ```powershell
   $env:DARI_RATE_LIMIT_SEARCH_MAX = "1000000"
   $env:API_PORT = "8090"
   $env:FIREBASE_CREDENTIALS_PATH = "C:\absolute\path\to\service-account.json"
   .\apps\api\mvnw.cmd -f apps\api\pom.xml spring-boot:run "-Dspring-boot.run.profiles=local"
   ```
   Run this from the repository root, not `apps/api` — the default Firebase
   credential path is relative to the process's working directory.
3. `k6 run infra/scripts/load-test-search.js` — a realistic filter mix (plain
   city browse, price range, property/room type, the amenity AND-filter,
   radius search, count, map), ramped from 0 to 50 virtual users over 30s,
   held for 2 minutes, ramped back down.

### What it found (2026-09-05)

The first run surfaced a real problem, not a tuning question: `GET
/listings/map` had no result cap — "get all map pins for public search (no
pagination)" was its own code comment. Against ~12,500 listings per city, an
unfiltered map request serialized every one of them: p95 1.79s, and the run's
total received payload was 2.5 GB over 2m45s dominated by that one endpoint.
A city that grows past a few thousand real listings would have made this
worse without bound, and every map-view page load would have shipped it to
the visitor's browser too.

Fixed by capping `mapPinsByLocationAndRadius` at 1,000 rows, ordered by
recency so a capped response is deterministic (`ListingSearchRepository`,
`ListingSearchService.MAP_PIN_LIMIT`). Re-running the identical load test
afterward:

| Endpoint | p95 before | p95 after |
| --- | --- | --- |
| `/listings` (search) | 606ms | 177ms |
| `/listings/map` | 1.79s | 201ms |
| `/listings` (radius) | 659ms | 230ms |
| `/listings/count` | 410ms | 122ms |
| Throughput | 136 req/s | 355 req/s |
| Data received (2m45s run) | 2.5 GB | 874 MB |

Every other endpoint also improved substantially even though nothing in
their own code changed — the single unbounded endpoint had been consuming a
disproportionate share of connection-pool and CPU time under concurrent load,
and removing that pressure freed capacity for everything else running
alongside it. Error rate was 0% in both runs; this was a latency and payload
problem, not a correctness one.

Neighborhood clustering on the map view (deferred at MVP per the design doc's
own §5 note) remains the real long-term answer for a city whose true
inventory exceeds the 1,000-row cap — the cap is a safety valve, not a
replacement for that decision.

### Acceptance thresholds

Recorded from the post-fix run above, on this project's dev-machine hardware
against 50,029 listings (matched in `infra/scripts/load-test-search.js`'s own
`thresholds` block, so a regression run fails loudly rather than needing a
human to read a number):

- Error rate: **< 1%**
- `/listings` (plain and filtered search): p95 **< 500ms**
- `/listings` (radius/closest sort): p95 **< 500ms**
- `/listings/count`: p95 **< 800ms** (a count scans further than the page it
  labels, so it is allowed more room)
- `/listings/map`: p95 **< 500ms**

These are floors observed on one machine with one dataset shape, not a
formal SLA — re-run the script after any change to the search/map query path,
a schema change touching the indexes in `V15__search_sort_indexes.sql`, or a
significant jump in expected production listing volume.
