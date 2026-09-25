# Launch rehearsal

The owner runs this on the **production infrastructure**, before real users arrive, after the
first deployment described in `docs/PRODUCTION_OPERATIONS.md`. It turns audit sections M.1–M.7,
the alert drill and the first restore drill into one checklist with a place to record each
result. Nothing here has been run against AWS yet; every row starts empty.

How to record: fill **Date**, **Result** (`PASS`, `FAIL` + one line, or `N/A` + why) and
**Operator** for each row. A `FAIL` blocks launch until it is fixed and the row re-run. Keep
secrets out of this file: record that a token worked, never the token.

Prerequisites:

- The API, web and media origins are live over HTTPS (`API_ORIGIN`, `WEB_ORIGIN`, `MEDIA_ORIGIN`
  below, e.g. `https://api.<domain>`, `https://www.<domain>`, `https://media.<domain>`).
- Three test accounts: a tenant, an owner, and an admin (`role = 'ADMIN'` set in the database by
  the operator). Use real mailboxes you can read.
- One published test annonce by the owner, **with a photo**, whose exact coordinates you entered
  yourself (you need them for section 5).
- The alarms applied ("Applying the alarms (Owner)" in `docs/PRODUCTION_OPERATIONS.md`).

---

## 1. Configuration and startup

Start with the script. It is read-only, sends no credentials, and prints `PASS`/`FAIL`/`SKIP`
per check with a non-zero exit status on any `FAIL`:

```bash
API_ORIGIN=https://api.<domain> WEB_ORIGIN=https://www.<domain> MEDIA_ORIGIN=https://media.<domain> \
LISTING_ID=<test annonce id> LISTING_EXACT_LAT=<lat you entered> LISTING_EXACT_LNG=<lng you entered> \
INTERNAL_API_HOST=<host part of the web's API_BASE_URL> \
  bash infra/prod-smoke/rehearsal-check.sh
```

It checks: HTTPS origins; `/actuator/health`, `/readiness`, `/liveness` UP; `/actuator/info`
shows a release that is not `development`; `/actuator/prometheus`, `/actuator/metrics` and
`/actuator/health/db` refused without a token; HSTS, CSP, `X-Frame-Options`, `nosniff`,
`Referrer-Policy` and `Permissions-Policy` on `/` and `/sign-in`; robots.txt and the sitemap
served and on `WEB_ORIGIN`; no internal host in `/`, `/sign-in`, robots.txt or the sitemap; a
missing annonce and profile answer 404 from the API, a missing profile answers 404 from the web,
and a missing annonce page answers 200 with `noindex` (deliberate: the page cannot tell "missing"
from "not public", so it falls back to the owner and moderator preview,
`apps/web/src/app/listings/[id]/page.tsx`); the public annonce JSON has
no owner, contact or exact-location field; the public point is within 200 m of the exact one but
not equal to it; the web annonce page does not contain the exact latitude; the audit P0-1 attack
(replaying the old unkeyed fuzzer) misses the exact point; the photo is served over HTTPS from
`MEDIA_ORIGIN` as an image.

`RATE_LIMIT_PROBE=1` adds 130 searches with rotating `X-Forwarded-For` and expects a 429. It is
off by default because it spends the caller's search quota for a minute; run it once, from a
machine that is not about to do anything else against the API. `CA_FILE=<pem>` trusts an extra
certificate (a staging CA); production certificates need nothing.

The script was proven against the local production smoke stack (`infra/prod-smoke`) with the
web production build and a self-signed TLS front for all three origins: 27 passed, 0 failed
with the probe on. With the front stripping `Strict-Transport-Security` it reported exactly the
two HSTS rows as `FAIL` and exited 1. It has not run against AWS.

| # | Step | Expected | Date | Result | Operator |
|---|---|---|---|---|---|
| 1.1 | Run `rehearsal-check.sh` with all optional variables set | `0 failed`; only the rate-limit probe `SKIP` | | | |
| 1.2 | Run it again with `RATE_LIMIT_PROBE=1` | `PASS rate limit held …` | | | |
| 1.3 | With an ordinary **user** token (from the browser's network tab after signing in as the tenant; do not paste it anywhere else): `curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" $API_ORIGIN/actuator/prometheus` | `403` | | | |
| 1.4 | Start one API task with each required variable removed in turn (a scratch task definition, not the service): at least `SMTP_HOST`, `DARI_LOCATION_FUZZ_SECRET`, `DARI_MEDIA_S3_ACCESS_KEY` | The task stops at startup and its log says `Production configuration is invalid`, naming the variable, printing no secret. CI already proves this against the image (`infra/prod-smoke/fail-fast-matrix.sh`); this row proves it on the real task definition | | | |
| 1.5 | Open `WEB_ORIGIN/sign-in` in Chrome with DevTools open, sign in | Zero CSP violations in the console; the form works (audit P0-10) | | | |
| 1.6 | Same for `/`, an annonce page, `/publish` (signed in) | Zero CSP violations; maps and photos load | | | |

## 2. Tenant journey

Desktop web, mobile web, then Android and iOS when the apps exist.

| # | Step | Expected | Date | Result | Operator |
|---|---|---|---|---|---|
| 2.1 | Search, filter by price, amenities and property type | Results match the filters | | | |
| 2.2 | Map view, open the test annonce | The pin is **near** the address, not on it (up to 200 m) | | | |
| 2.3 | Favorite it; reload | Still favorited | | | |
| 2.4 | Contact the owner, send a message | The owner sees it within the polling interval | | | |
| 2.5 | Owner replies | The tenant sees the reply; an unread badge appears | | | |
| 2.6 | Report the annonce | A neutral acknowledgement that says nothing about the outcome; the tenant receives the « Votre signalement Dari » email | | | |

## 3. Owner journey

Desktop web, then Android and iOS.

| # | Step | Expected | Date | Result | Operator |
|---|---|---|---|---|---|
| 3.1 | Sign up with a new email | Email verification is required before the profile can be created | | | |
| 3.2 | Create the profile, upload an avatar | The avatar shows on the public profile, served from `MEDIA_ORIGIN` | | | |
| 3.3 | Create a draft: location, property details, rooms, photos (upload, set cover, reorder, delete one) | Each step saves; photos served from `MEDIA_ORIGIN` | | | |
| 3.4 | Submit | Status `PENDING_REVIEW`; **not** in public search | | | |
| 3.5 | Admin approves (section 4) | The annonce appears in search; the owner receives the **approval email** | | | |
| 3.6 | Receive a message | Visible in the inbox | | | |
| 3.7 | Mark the room found | The annonce leaves search | | | |
| 3.8 | Reopen, edit | Back to `PENDING_REVIEW` and out of search until approved again | | | |
| 3.9 | Renew | The expiry date moves forward | | | |

## 4. Admin journey and moderation email

| # | Step | Expected | Date | Result | Operator |
|---|---|---|---|---|---|
| 4.1 | Sign in as admin, open the pending queue | Pending annonces listed | | | |
| 4.2 | Approve one | The owner receives the approval email (**moderation email arrives**) | | | |
| 4.3 | Reject one with a reason | The owner receives the rejection email **quoting the reason** | | | |
| 4.4 | Report queue: dismiss a report | Report closed | | | |
| 4.5 | Suspend an annonce | It leaves search; the owner is emailed | | | |
| 4.6 | Suspend the tenant | The tenant can still read but every write answers « Ce compte est suspendu (lecture seule) » | | | |
| 4.7 | Unsuspend | Writes work again | | | |
| 4.8 | Ban a throwaway user; try to sign up again with the same email | Sign-up refused (« Inscription impossible ») | | | |
| 4.9 | `SELECT action, target_type, created_at FROM admin_actions ORDER BY created_at DESC LIMIT 20;` (operator's database access) | One row per action above | | | |

## 5. Privacy and deletion

| # | Step | Expected | Date | Result | Operator |
|---|---|---|---|---|---|
| 5.1 | Section 1's script with `LISTING_EXACT_LAT/LNG` set | The coordinate, page and P0-1 rows all `PASS` | | | |
| 5.2 | View source of the annonce page; open the sitemap | No coordinates in JSON-LD, Open Graph tags or the sitemap | | | |
| 5.3 | Upload a photo that has GPS EXIF (any phone photo with location on); download it back from `MEDIA_ORIGIN`; `exiftool photo.jpg \| grep -i gps` | No GPS fields (uploads are re-encoded) | | | |
| 5.4 | Note the throwaway owner's avatar URL and one photo URL; delete that account | PII scrubbed; annonces gone from search; the counterparty's conversation still readable, the sender shown as « Utilisateur supprimé » | | | |
| 5.5 | Two minutes later: `aws s3api head-object --bucket <media bucket> --key <avatar key>` (the S3 key is the URL path after the `MEDIA_ORIGIN` host, which is CloudFront) and the same for the photo | `Not Found` for both (the cleanup worker runs every 60 s) | | | |
| 5.6 | `curl -sI <avatar URL>` through CloudFront | `403`/`404` once the edge copy expires; it may still answer `200` for up to an hour (`max-age=3600`) | | | |
| 5.7 | Firebase console → Authentication: search the deleted email | Not found | | | |
| 5.8 | Sign up again with the deleted account's email | Allowed | | | |

## 6. Failure injection

Before launch or in an announced window: these disturb production.

| # | Step | Expected | Date | Result | Operator |
|---|---|---|---|---|---|
| 6.1 | Stop the RDS instance (or remove the ECS→RDS security-group rule) mid-session; use the web app | A French error, no stack trace, no hang; `/actuator/health/readiness` answers 503 | | | |
| 6.2 | Restore it | Recovery **without** an API restart; readiness back to 200 | | | |
| 6.3 | Point `SMTP_HOST` at a closed port (scratch task revision); trigger an email | Outbox rows retry, then `DEAD`; no credentials in the logs; alarm 4 fires. Restore and re-queue ("First response", alert 4) | | | |
| 6.4 | Deny `s3:PutObject` on the media user temporarily; upload a photo | 503 with a French message; restore the policy; a queued deletion retries and succeeds | | | |
| 6.5 | Deploy a new task revision while a request is in flight | In-flight requests complete (graceful shutdown drains) | | | |
| 6.6 | Upload a 5 MB PNG that declares 30 000 × 30 000 pixels | Rejected; the API stays up (audit P0-6) | | | |
| 6.7 | Airplane mode on every mobile screen, then reconnect | French offline message; recovery on reconnect | | | |
| 6.8 | On web, let the token expire (or revoke it in Firebase) mid-session | Re-authentication, not a dead page | | | |

## 7. Accessibility spot-check

| # | Step | Expected | Date | Result | Operator |
|---|---|---|---|---|---|
| 7.1 | Keyboard only: complete the publish wizard | Every step reachable and operable; visible focus | | | |
| 7.2 | Keyboard only: open and close the report dialog | Focus returns to the trigger | | | |
| 7.3 | Keyboard only: traverse the search filters | Logical order, visible focus | | | |
| 7.4 | Screen reader (NVDA or VoiceOver): the sort control | Not announced as a tab | | | |
| 7.5 | Screen reader: receive a message in an open thread | The new message is announced | | | |

`docs/ACCESSIBILITY_MANUAL_CHECKLIST.md` has the longer manual list.

## 8. Alert drill

Follow "Alert drill" in `docs/PRODUCTION_OPERATIONS.md` for how to cause and clear each one.
Record the three times for each.

| # | Alarm | Triggered at | ALARM email at | OK email at | Operator |
|---|---|---|---|---|---|
| 8.1 | `dari-01-api-unreachable` (invert the Route 53 health check) | | | | |
| 8.2 | `dari-02-elevated-5xx` (desired count 0, before launch only) | | | | |
| 8.3 | `dari-03-database-unreachable` (security-group rule removed; alarm 1 must **not** fire) | | | | |
| 8.4 | `dari-04-notification-outbox-stuck` (the `ALERT_DRILL` row) | | | | |
| 8.5 | `dari-05-media-cleanup-failing` (the `alert-drill/never-stored.jpg` row) | | | | |
| 8.6 | `dari-06-daily-backup-missing` (before the first daily backup, or pause the rule) | | | | |

## 9. First restore drill (sets the RTO)

The RTO is not measured yet (`docs/PRODUCTION_OPERATIONS.md`, "Restore verification and
disaster recovery"). This drill measures it. Never restore over the running database.

| # | Step | Expected | Date | Result | Operator |
|---|---|---|---|---|---|
| 9.1 | Take a pre-deploy dump (`infra/scripts/backup.sh`, "Pre-deploy dump") and upload it to the backup bucket | Archive and `.sha256` in the bucket, encrypted, under retention | | | |
| 9.2 | `infra/scripts/restore-drill.sh <archive>` on the operations host | All checks pass; record each phase's seconds | | | |
| 9.3 | RDS: restore to a point in time into a **new** private instance; run the SQL checks from the same section; delete the instance | Counts match production at that time; record the minutes from request to usable | | | |
| 9.4 | Copy both measured times into the RTO table in `docs/PRODUCTION_OPERATIONS.md` | Table filled, with date, source size and operator | | | |
| 9.5 | Confirm a weekly snapshot copy exists in the backup account's vault | Present, locked | | | |

## 10. Sign-off

| Item | Date | Operator |
|---|---|---|
| Sections 1–9 all `PASS` or justified `N/A` | | |
| Legal packet (`docs/LEGAL_PREP.md`) answered by counsel; the eleven `DARI_LEGAL_*` values are final | | |
| Audit §R launch gate reviewed item by item | | |
| Someone is watching the alerts for the first hour after launch | | |
