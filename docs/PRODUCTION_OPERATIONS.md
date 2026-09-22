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
an idempotent `media_cleanup` row; the worker retries failed remote deletion,
keeps the failure observable in the row's attempt/error fields, and gives up in
a `DEAD` state that needs an operator (see "Dead media cleanup rows" below).

The CDN must stop future origin access when a listing is deleted. Objects that
were already cached can remain visible until the configured cache TTL expires;
choose that TTL explicitly and document it with the CDN configuration.

### Storage keys, erasure and cache lifetime

The database stores storage keys (`listing_photos.storage_key`,
`users.avatar_storage_key`), never rendered URLs. Each response renders the
key for the running configuration: `DARI_MEDIA_PUBLIC_BASE_URL/<key>` in S3
mode, `/uploads/<key>` in local mode. The JSON field names (`url`,
`avatarUrl`) and shapes are unchanged, and moving the CDN origin needs no data
migration.

Deleting a photo, replacing an avatar and deleting an account each enqueue the
affected keys in `media_cleanup`, in the same transaction as the change. In
local mode the API stops serving an enqueued key immediately. In **S3 mode the
object stays readable from the bucket and CDN until the worker deletes it**:
those requests never reach the API. Erasure in S3 mode is therefore complete
only after both of these have passed:

1. **Cleanup delay.** The worker runs every `DARI_MEDIA_CLEANUP_INTERVAL_MS`
   (60 s by default), so a healthy bucket is cleaned within about a minute.
   While S3 fails, retries back off up to an hour between attempts.
2. **Cache lifetime.** Uploads carry `Cache-Control: public, max-age=3600`
   (`DARI_MEDIA_S3_CACHE_CONTROL`), so a CDN edge or browser that already
   fetched a photo may keep showing it for up to **one hour** after the object
   is gone. Keys never change content (a new upload gets a new key), so a
   longer lifetime costs nothing in correctness, only in erasure lag, and a
   shorter one costs origin requests. One hour is the chosen balance; raising
   it is a privacy decision. CloudFront honours the origin header only within
   the cache policy's TTL range: set the policy's **maximum TTL to 3600 s or
   less**, or a longer policy TTL silently overrides this. Removing a photo
   from the edge immediately would need a CloudFront invalidation per
   deletion, which is not built.

Before V26, `users.avatar_url` held the rendered URL, and in S3 mode neither
avatar replacement nor account deletion enqueued the old object, which stayed
public indefinitely. V26 backfills `avatar_storage_key` from both URL shapes
and is expand-only:

- This release never reads `avatar_url` and no longer writes it on upload; it
  only clears it when an account is scrubbed, because it may still point at the
  person's photo.
- While the previous release can still run (a rolling deploy, or a rollback),
  it keeps writing only `avatar_url`. The trigger `users_sync_avatar_storage_key`
  keeps the key in step with those writes, so a later roll-forward does not
  read a stale key.
- **Rollback caveat:** the previous release reads `avatar_url`. After a
  rollback, someone who changed their avatar under this release is shown their
  older avatar URL, whose object has already been deleted, and account deletion
  under that release in S3 mode enqueues nothing (the original defect). Roll
  forward promptly.
- **Contract step, in a later release** once no pre-V26 release can be
  deployed: drop the trigger `users_sync_avatar_storage_key`, the functions
  `users_sync_avatar_storage_key()` and `avatar_storage_key_from_url(text, uuid)`,
  then the column `users.avatar_url`.

### Bounds on external calls

Every S3 call has a connect timeout (`DARI_MEDIA_S3_CONNECT_TIMEOUT_MS`, 2000
ms) and a request timeout (`DARI_MEDIA_S3_REQUEST_TIMEOUT_MS`, 10000 ms). An
I/O error, a timeout or a 5xx is retried once after 200 ms with a fresh
signature; a 3xx or 4xx is not retried. Both PUT and DELETE are safe to repeat:
every key is a new random UUID, and deleting an absent key succeeds. The worst
case for one call is 2 x (2 + 10) s + 0.2 s = 24.2 s, after which an upload
returns the French 503. Any non-2xx upload response is a failure; a wrong-region
`301 PermanentRedirect` used to be counted as a stored photo. S3 error bodies
are never read or logged.

The Firebase Admin SDK defaults to no timeout at all. It now uses
`DARI_FIREBASE_CONNECT_TIMEOUT_MS` (5000 ms) and `DARI_FIREBASE_READ_TIMEOUT_MS`
(10000 ms). `deleteUser` runs inside the account-deletion transaction, so these
bound how long that transaction holds its row locks: at most 15 s when Google
does not answer (the SDK does not retry I/O errors), and up to about 82 s if
Google keeps answering HTTP 503, which the SDK retries four times with a
0.5/1/2/4 s backoff. Any failure returns 502 and rolls the whole deletion back.

All five are optional, with the defaults above; none is a required production
variable.

### Dead media cleanup rows

The worker runs every `DARI_MEDIA_CLEANUP_INTERVAL_MS` (60 s) on one instance
at a time (ShedLock lock `mediaCleanup`), takes at most 50 due rows per run,
and saves each row's outcome on its own. A failed deletion is retried after 60
s, 2, 4, 8, 16 and 32 min, then hourly. After `DARI_MEDIA_CLEANUP_MAX_ATTEMPTS`
failures (10 by default, about 4 h after the first) the row becomes `DEAD`:
the worker stops trying, and the object **may still exist**. The key stays
revoked, so the API keeps refusing to serve it in local mode, but in S3 mode
the object stays readable from the bucket and CDN until someone acts.

Signals: the gauge `dari.media.cleanup_depth{status="DEAD"}` is above zero, the
counter `dari.media.cleanup{outcome="dead"}` has increased, and the log line
`Media cleanup row <id> is DEAD after <n> attempts (<reason>)`. Any DEAD row
needs a person. (`outcome="error"` counts rows whose result could not be saved;
they stay PENDING and are retried on the next run.)

Run these through the operator's database access, never from an application
host:

```sql
-- 1. Inspect.
SELECT id, storage_key, attempts, last_error, updated_at
FROM media_cleanup
WHERE status = 'DEAD'
ORDER BY updated_at;
```

`last_error` ends with the technical cause in parentheses:

| Cause | Usual meaning | Fix before re-queueing |
| --- | --- | --- |
| `S3 DELETE failed: HTTP 403` | the IAM user lacks `s3:DeleteObject` on the bucket, or the keys or bucket are wrong | the IAM policy or the secrets |
| `S3 DELETE failed: HTTP 301` | wrong region or endpoint for the bucket | `DARI_MEDIA_S3_REGION` / `DARI_MEDIA_S3_ENDPOINT` |
| `HttpTimeoutException`, `HttpConnectTimeoutException`, `HTTP 5xx` | storage unreachable for longer than the retry horizon | wait for the provider, then re-queue |
| `Clé de stockage invalide` (local mode) | a key outside the upload root; the application never writes one | investigate how the row was created |

```sql
-- 2. Re-queue once the cause is fixed: one row ...
UPDATE media_cleanup
SET status = 'PENDING', attempts = 0, next_attempt_at = now(), updated_at = now()
WHERE status = 'DEAD' AND id = '<id>';

-- ... or every DEAD row, after a systemic fix.
UPDATE media_cleanup
SET status = 'PENDING', attempts = 0, next_attempt_at = now(), updated_at = now()
WHERE status = 'DEAD';
```

Resetting `attempts` gives each key a full new retry budget. Never `DELETE` a
`media_cleanup` row: its existence is what revokes the key, and without it a
still-present file would be served again. Verify that the rows reach
`DELETED` within a few minutes, the DEAD gauge returns to 0, and, in S3 mode,
that the objects are gone from the bucket.

If an instance is killed during a run, the `mediaCleanup` lock is held until
its `lockAtMostFor` of 25 minutes expires (50 rows x 24.2 s worst case per S3
call, rounded up), which delays cleanup but loses nothing. Check with
`SELECT * FROM shedlock WHERE name = 'mediaCleanup';`.

A release older than V27 (a rollback) cannot enqueue a key that already has a
DEAD row (its duplicate check hits the unique index and fails the request), and
in local mode it serves a DEAD key's file. Roll forward promptly.

The rate limiter is intentionally process-local and has a configurable
`DARI_RATE_LIMIT_MAX_TRACKED_KEYS` limit (100,000 by default). At the limit it
first purges expired keys, then applies new callers to a fixed shared overflow
bucket instead of allocating another key or allowing the request. The cap-hit
counter is retained for operational diagnosis. Redis-backed rate limiting is a
mandatory prerequisite before horizontal API scaling.

Every Next.js server render (Server Components, `generateMetadata`, ISR pages,
`sitemap.ts`, `robots.ts`) reaches the API from the web runtime's one address
and carries no trustworthy visitor address, so a per-address quota would
throttle every visitor together. The web runtime therefore identifies itself
with the server-only shared secret `DARI_SSR_SHARED_SECRET`, sent in the
`X-Dari-Ssr-Key` header by `apiFetch` only when it runs on the server:

- A **read** (`SEARCH` or `SSR_READ` policy) whose key matches, compared in
  constant time, draws on one shared bucket,
  `DARI_RATE_LIMIT_SSR_READ_MAX` / `DARI_RATE_LIMIT_SSR_READ_WINDOW`
  (10,000/minute by default), plus a per-Firebase-user window when the call is
  authenticated. It never touches the web host's per-address bucket.
- **Every other request** — browsers, the mobile app, anyone with a missing or
  wrong key — gets the normal per-address (and per-user) limit under the
  `SEARCH` policy, including on endpoints annotated `SSR_READ` (listing detail
  `/listings/{id}` and public profiles `/users/{id}`). An unkeyed caller cannot
  spend the shared SSR budget, and listing enumeration is bounded per address.
  Cities, amenities and neighborhoods are browser/mobile reference routes and
  are annotated `SEARCH`.
- **Mutation policies** (signup, upload, report, message, listing) ignore the
  header entirely.

Every server-side API call the web app makes (verified against a production
build and `next start`, 2026-09-22; all go through `apiFetch`, so all carry the
key and none lands in a per-address bucket):

| Web route (render mode) | API call | Endpoint policy | Limiter with the key |
| --- | --- | --- | --- |
| `/` (ISR, 15 min) | `GET /listings/featured?limit=4`, `GET /listings/count`, `GET /listings/count?city=…` ×4 | `SEARCH` | shared SSR |
| `/flatshare/[city]` (SSG + ISR, 15 min) | `GET /listings?city=…&sort=updated\|priceasc\|pricedesc`, `GET /listings/count?city=…` | `SEARCH` | shared SSR |
| `/listings/[id]` (dynamic; `generateMetadata` and page share one call) | `GET /listings/{id}` | `SSR_READ` | shared SSR |
| `/profile/[id]` (dynamic) | `GET /users/{id}` | `SSR_READ` | shared SSR |
| `/sitemap/[id].xml` (static at build) | `GET /listings/sitemap/count`, `GET /listings/sitemap?limit=…&offset=…` | `SEARCH` | shared SSR |
| `/robots.txt` (static at build) | `GET /listings/sitemap/count` | `SEARCH` | shared SSR |

Before this key existed, the `SEARCH` calls above counted against the web
host's own address at 120/minute. Everything else in the web app calls the
API from the browser and is limited per visitor address.

The header is not in the CORS allow-list, so browser JavaScript on another
origin cannot send it, and the value is never logged, echoed, put in error
bodies or used as a metric tag. The secret is required in production on both
sides (at least 32 characters; the API's startup check, the validation
scripts and the web build gate all enforce it). **Rotation:** change it on the
API and the web service in the same deploy. During a mismatch nothing breaks
outright, but server renders fall back to the web host's per-address `SEARCH`
quota (120/minute by default) and start returning 429 under load.

Known limits, deliberately deferred: per-visitor fairness for anonymous SSR
traffic does not exist — anyone who can drive many page renders can still
spend the shared SSR budget, bounded only by the web host's edge and by ISR
caching. Mobile and browser callers share the per-address `SEARCH` limit, which
can be tight behind carrier-grade NAT; `DARI_RATE_LIMIT_SEARCH_MAX` stays
tunable for that reason.

Production uses Tomcat's native `RemoteIpValve`, not Spring's framework
forwarded-header transformer. `DARI_TRUSTED_PROXY_IPS` is required and must be
a Java regular expression matching only the target-facing private addresses of
the ALB nodes (normally the specific ALB subnet ranges), never a client or a
broad private range. The ECS security group must likewise admit port 8080 only
from the ALB security group. For a TCP peer matching that expression, Tomcat
walks `X-Forwarded-For` from right to left and uses the first non-proxy address.
It also consumes `X-Forwarded-Proto`, so TLS termination still makes the
request secure and keeps API HSTS active.

Keep ALB attribute `routing.http.xff_header_processing.mode=append` (the AWS
default). Append retains a caller-supplied chain but adds the source address
the ALB observed at its right edge; therefore a forged leftmost value cannot
choose the limiter bucket. Do not use `preserve`. AWS documents this behaviour
in [HTTP headers and Application Load Balancers](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html).

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
first real upload and its public URL before accepting the release. The
repository tests sign against MinIO, which checks SigV4 the way S3 does, but
path-style signing against `s3.<region>.amazonaws.com` has not been exercised
from here.

### Configuration and secrets

Put non-secret configuration in the ECS task definition environment and secret
values in SSM Parameter Store `SecureString`, referenced by the task
definition. Do not put values in image layers, source control, or command
history.

| Task-definition environment | SSM `SecureString` |
| --- | --- |
| `SPRING_PROFILES_ACTIVE=production`, `DB_URL`, `DARI_WEB_ORIGIN`, `DARI_TRUSTED_PROXY_IPS`, `DARI_MEDIA_PROVIDER=s3`, `DARI_MEDIA_PUBLIC_BASE_URL`, `DARI_MEDIA_S3_ENDPOINT`, `DARI_MEDIA_S3_REGION`, `DARI_MEDIA_S3_BUCKET`, `SMTP_HOST`, `SMTP_PORT=587` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DARI_LOCATION_FUZZ_SECRET`, `DARI_SSR_SHARED_SECRET`, `DARI_MEDIA_S3_ACCESS_KEY`, `DARI_MEDIA_S3_SECRET_KEY`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `DARI_NOTIFICATIONS_FROM`, Firebase service-account JSON |

Set `FIREBASE_CREDENTIALS_PATH=/run/secrets/firebase/service-account.json` in
the API container. Add a non-essential BusyBox init container that reads the
Firebase JSON SecureString, writes it to a task-scoped shared volume, then
sets owner `10001` and mode `0400`. The API container mounts that volume
read-only and uses `dependsOn` with condition `SUCCESS`; do not copy this key
into the image or an environment variable.

Store `DARI_LOCATION_FUZZ_SECRET` as a Parameter Store `SecureString` with at
least 32 characters. It keys the deterministic public listing-pin offsets;
rotating it deliberately moves every public pin and should be coordinated with
product support rather than treated as an invisible credential rotation.

Store `DARI_SSR_SHARED_SECRET` the same way (at least 32 characters) and
reference the **same** parameter from the web service's task definition; the
web app needs it at `next build` and at runtime, as a server-only variable
(never a `NEXT_PUBLIC_` name). Rotate it on both services in one deploy, as
described under "Media, rate limits, and proxy boundary".

### Web service configuration and headers

`apps/web/next.config.mjs` is the single production gate: `next build` and
`next start` refuse to run without every variable below (HTTPS enforced, API
URLs must end in `/api/v1`, `DARI_SSR_SHARED_SECRET` at least 32 characters)
plus the eleven `DARI_LEGAL_*` values. `apps/web/.env.production.example`
lists them with placeholders.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | public, inlined into browser JS | browser → API |
| `API_BASE_URL` | server only; may be an internal address | Next.js server → API; never used for anything rendered |
| `NEXT_PUBLIC_MEDIA_ORIGINS` | public | comma-separated HTTPS media origins; the first prefixes root-relative `/uploads/...` paths, absolute S3/CloudFront URLs pass through and their origin must be listed; feeds the CSP `img-src` |
| `NEXT_PUBLIC_SITE_URL` | public | canonicals, Open Graph, sitemap, robots |
| `NEXT_PUBLIC_FIREBASE_*` | public by design | Firebase web config; the auth domain feeds CSP `connect-src`/`frame-src` |
| `DARI_SSR_SHARED_SECRET` | server only, secret (SSM `SecureString`) | same value as the API's; needed at build and runtime |

Every response carries one static policy, prerendered or not:
`Content-Security-Policy` (`script-src 'self' 'unsafe-inline'`, `style-src
'self' 'unsafe-inline'`, `font-src 'self'`, `img-src`/`connect-src` from the
media and public API origins, `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`),
`Strict-Transport-Security: max-age=31536000; includeSubDomains`,
`Permissions-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options:
nosniff` and `Referrer-Policy`. There is no middleware and no nonce: cached HTML
cannot carry a per-request nonce, which previously stopped every prerendered
page from hydrating (`docs/PHASE1_CSP_REPRODUCTION.md`). `'unsafe-inline'` in
`script-src` is required by the App Router's inline flight-data scripts; a
stricter policy would mean rendering every route per request with a nonce.
HSTS deliberately omits `preload`; submitting the domain to browser preload
lists is a separate decision for the domain owner and hard to undo. Fonts are
self-hosted by `next/font`; no font host is allowed or contacted.

`.next/cache/fetch-cache` (Next's server-side data cache) stores the upstream
URL of each server fetch, so it contains the internal `API_BASE_URL` host. It is
never served over HTTP; do not publish the `.next` directory as static files.
Nothing served to browsers (HTML, RSC payloads, sitemap, robots,
`.next/static`) contains that host; the production-build e2e project checks it.

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
./infra/prod-smoke/verify-rate-limit.sh
docker compose -f infra/prod-smoke/docker-compose.yml down -v
```

On PowerShell, invoke the matrix with `bash ./infra/prod-smoke/fail-fast-matrix.sh`.
Always run `down -v` when finished; it removes only this smoke project's
throwaway volumes.
