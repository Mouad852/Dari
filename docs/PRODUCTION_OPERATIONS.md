# Production operations

This runbook covers the production PostgreSQL backup policy and the deployment
rollback procedure for Dari. It deliberately does not cover a Firestore mirror;
PostgreSQL remains the authoritative application store.

## Media, rate limits, and proxy boundary

Set `DARI_MEDIA_PROVIDER=s3`, a private bucket, and the S3-compatible endpoint,
region, access key, secret key, bucket, and public/CDN base URL through the
deployment secret store. MinIO is suitable for local development; production
credentials must never be committed. Published media may be delivered through
the public base URL. Deleted photos, avatars, and soft-deleted listings enqueue
an idempotent `media_cleanup` row; the worker retries failed remote deletion and
keeps the failure observable in the row's attempt/error fields.

The CDN must stop future origin access when a listing is deleted. Objects that
were already cached can remain visible until the configured cache TTL expires;
choose that TTL explicitly and document it with the CDN configuration.

The rate limiter is intentionally process-local. Redis-backed rate limiting is
a mandatory prerequisite before horizontal API scaling, as is an explicit
trusted-proxy boundary and an allowlisted proxy configuration. The API does not
blindly trust `X-Forwarded-For` or other forwarded headers.

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

## Production deployment (AWS, managed services)

This is the selected **AWS Option A** deployment shape. It is a small
production baseline, not a free-tier-only configuration: Fargate, an ALB, and
public IPv4 addresses incur charges. Budget roughly **USD 40–60/month** as an
estimate, then confirm the actual region and traffic assumptions with the AWS
Pricing Calculator. Create a budget alert before provisioning. Choose a region
with the business's data-residency obligations in mind (for example,
`eu-west-3` or `eu-south-2`).

### Target architecture

- ACM terminates TLS at an internet-facing ALB. Its target group checks
  `/actuator/health/readiness` with a 6-second timeout and a 45-second
  deregistration delay.
- The ECS Fargate service runs one task (0.5 vCPU, 1 GB) in a public subnet
  with `assignPublicIp` enabled and no NAT gateway. Its security group accepts
  port 8080 only from the ALB security group.
- The API container has an ECS health check on
  `/actuator/health/liveness` (the image contains `curl`), a 120-second
  `startPeriod`, a 75-second `stopTimeout`, and the service has a 120-second
  health-check grace period. Deploy with minimum healthy percent 100, maximum
  percent 200, and the ECS deployment circuit breaker with rollback enabled.
- Run PostgreSQL 16 with PostGIS on private RDS (`db.t4g.micro`). Before the
  first app start, the RDS master user creates role `dari`, database `dari`,
  and enables `postgis` and `pgcrypto` there. Migration V1 needs
  `rds_superuser` for those extensions; the application must subsequently
  connect only as `dari`.
- Store originals in a private S3 bucket and serve them through CloudFront
  using Origin Access Control. Set `DARI_MEDIA_PUBLIC_BASE_URL` to the
  CloudFront HTTPS origin.
- SES SMTP is `email-smtp.<region>.amazonaws.com:587` with STARTTLS. Configure
  the sending domain's DKIM, SPF, and DMARC, request production access to leave
  the SES sandbox, and use SES SMTP credentials (they are not IAM access keys).

`S3ImageStore` currently requires a dedicated `dari-media` IAM user with
static access keys limited to `s3:PutObject` and `s3:DeleteObject` on this
bucket. It does not send `x-amz-security-token`, so an ECS task role cannot
substitute for these credentials. It also uses path-style S3 URLs; verify the
first real upload and its public URL before accepting the release.

### Configuration and secrets

Put non-secret configuration in the ECS task definition environment and secret
values in SSM Parameter Store `SecureString`, referenced by the task
definition. Do not put values in image layers, source control, or command
history.

| Task-definition environment | SSM `SecureString` |
| --- | --- |
| `SPRING_PROFILES_ACTIVE=production`, `DB_URL`, `DARI_WEB_ORIGIN`, `DARI_MEDIA_PROVIDER=s3`, `DARI_MEDIA_PUBLIC_BASE_URL`, `DARI_MEDIA_S3_ENDPOINT`, `DARI_MEDIA_S3_REGION`, `DARI_MEDIA_S3_BUCKET`, `SMTP_HOST`, `SMTP_PORT=587` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DARI_MEDIA_S3_ACCESS_KEY`, `DARI_MEDIA_S3_SECRET_KEY`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `DARI_NOTIFICATIONS_FROM`, Firebase service-account JSON |

Set `FIREBASE_CREDENTIALS_PATH=/run/secrets/firebase/service-account.json` in
the API container. Add a non-essential BusyBox init container that reads the
Firebase JSON SecureString, writes it to a task-scoped shared volume, then
sets owner `10001` and mode `0400`. The API container mounts that volume
read-only and uses `dependsOn` with condition `SUCCESS`; do not copy this key
into the image or an environment variable.

### Build and first deployment

Authenticate Docker to ECR using an AWS CLI profile that the operator has
already configured, then build and push an immutable image tag derived from
the checked-out commit. Never retag an already released SHA.

```bash
git_sha="$(git rev-parse --verify HEAD)"
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"
docker build -t "$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/dari-api:$git_sha" apps/api
docker push "$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/dari-api:$git_sha"
```

Provision the network, ACM certificate, ALB, RDS, S3/CloudFront, ECR,
Parameter Store entries, IAM permissions, ECS cluster, task definition, and
service using reviewed infrastructure configuration. Register the image SHA in
a new task-definition revision and deploy the service. The API applies Flyway
migrations on startup; take a verified backup first and allow the new task to
become ready before draining the old task. Never run `flyway clean` in any
environment holding production data.

### Routine deploy and rollback

For each release, build and push a new SHA tag, register a new task-definition
revision with that exact image, update the ECS service, and wait for its
deployment to stabilize. Check the ALB readiness target, liveness endpoint,
application logs, and a real media upload before declaring the release good.

If the release fails, select the previous known-good ECS task-definition
revision and update the service back to it. Confirm target health and user
flows after rollback. Database migrations are forward-only: do not use
`flyway clean`, and do not roll back schema by deleting migration history.
Prepare a compensating migration only when a rollback cannot safely run
against the migrated schema.

### Production smoke stack

Run this local, throwaway production-profile check before a release. It is not
a deployment and uses only smoke credentials:

```bash
docker compose -f infra/prod-smoke/docker-compose.yml up -d --build --wait
curl -fsS http://localhost:18080/actuator/health/liveness
curl -fsS http://localhost:18080/actuator/health/readiness
./infra/prod-smoke/fail-fast-matrix.sh
docker compose -f infra/prod-smoke/docker-compose.yml down -v
```

On PowerShell, invoke the matrix with `bash ./infra/prod-smoke/fail-fast-matrix.sh`.
Always run `down -v` when finished; it removes only this smoke project's
throwaway volumes.
