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
