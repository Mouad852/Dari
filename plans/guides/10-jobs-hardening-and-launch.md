# Guide — Phase 10: Jobs, hardening and launch

Implementation guide for [`10-jobs-hardening-and-launch.md`](../10-jobs-hardening-and-launch.md).

**The phase most likely to get compressed, containing the work least survivable to compress.** The expiry job completes §4's lifecycle. The notification delivery is what phases 06 and 08 assumed existed. The fuzzing review is the difference between a privacy scheme and a decorative one.

If the schedule tightens, pull the fuzzing review and rate limits *forward* rather than cutting them.

The rate-limit boundary includes both authenticated write abuse paths and anonymous public search
traffic. Report creation, conversation/message writes, listing creation, photo/avatar uploads, and
profile signup use identity and source-address buckets. Search, count, map, and featured reads use
source-address buckets so one anonymous visitor cannot consume a global anonymous quota.

---

## 0. Decisions to settle first

**Expiry window → 60 days, warned at 53.** §4 gives a range. Sixty days keeps the marketplace credible; a room advertised three months ago is usually gone, and stale listings are the exact failure of the Facebook groups Dari is replacing. A week's warning is enough to act on without being forgettable.

**"Update" for the expiry clock → a deliberate renewal, not any `PATCH`.** Otherwise a listing kept alive by trivial edits defeats the purpose, and worse, an autosave from the wizard would silently reset the clock. Track `last_renewed_at` separately from `updated_at`.

**Email provider → a transactional provider with a real deliverability record to Moroccan inboxes.** Test actual delivery to Gmail, Outlook and at least one Moroccan ISP before committing; deliverability is the whole product here, and a provider that lands in spam is worse than useless.

---

## 1. Expiry job

```sql
ALTER TABLE listings
    ADD COLUMN last_renewed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN expiry_warned_at  TIMESTAMPTZ;

CREATE INDEX idx_listings_expiry
    ON listings (last_renewed_at)
    WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
```

```java
@Scheduled(cron = "0 0 3 * * *")   // 03:00 Africa/Casablanca, off-peak
@SchedulerLock(name = "listingExpiry", lockAtMostFor = "30m")
@Transactional
public void expireStaleListings() {
    var warnBefore   = Instant.now().minus(53, DAYS);
    var expireBefore = Instant.now().minus(60, DAYS);

    // Warn first, so expiry is never a surprise.
    listings.findPublishedRenewedBefore(warnBefore).stream()
            .filter(l -> l.getExpiryWarnedAt() == null)
            .forEach(l -> {
                notifications.listingExpiringSoon(l, 7);
                l.setExpiryWarnedAt(Instant.now());
            });

    listings.findPublishedRenewedBefore(expireBefore).forEach(l -> {
        transitions.transition(l, EXPIRED, SYSTEM);   // phase 02 state machine
        notifications.listingExpired(l);
    });
}
```

Three things this gets right:

**`@SchedulerLock`** (ShedLock) — without it, two instances both expire the same listings and send duplicate emails. Add it before you ever run two instances, not after.

**Idempotency.** `expiry_warned_at` means a re-run does not re-warn. The `EXPIRED` transition is naturally idempotent because the state machine rejects `EXPIRED → EXPIRED`. Assume the job will be run twice by accident, because eventually it will be.

**Renewal re-enters review** (§4), which phase 02's machine already enforces — `EXPIRED → PENDING_REVIEW` is the only legal exit:

```java
public void renew(Listing l, User owner) {
    requireOwner(l, owner);
    transitions.transition(l, PENDING_REVIEW, owner);
    l.setLastRenewedAt(Instant.now());
    l.setExpiryWarnedAt(null);
}
```

---

## 2. Notifications

Phase 06 defined the interface and stubbed it. Implement it here.

```java
public interface NotificationService {
    void listingApproved(Listing l);
    void listingRejected(Listing l, String reason);
    void listingSuspended(Listing l, SuspensionSource source);
    void listingReinstated(Listing l);
    void userWarned(User u, String reason);
    void userSuspended(User u, String reason);
    void userBanned(User u, String reason);
    void listingExpiringSoon(Listing l, int days);
    void listingExpired(Listing l);
    void reportAcknowledged(Report r);      // generic — reveals nothing (§6)
}
```

Grep for every call site before implementing. The failure mode here is not a broken transport, it is a moderation decision that lands silently on an owner because someone forgot the call.

### Templates

French, following the copy rules exactly — the same rules as the UI. No emoji. **No exclamation marks.** Plain and non-blaming.

Moderator `WARN` actions use the same transactional outbox and enqueue a
`USER_WARNED` message for the listing owner or user target before resolving the
pending reports as `ACTION_TAKEN`.

```
Subject: Votre annonce n'a pas été publiée

Bonjour {{firstName}},

Votre annonce « {{title}} » n'a pas été publiée pour la raison suivante :

{{reason}}

Vous pouvez la modifier et la soumettre à nouveau depuis votre espace.

{{ctaUrl}}

— Dari
```

*Vous*, sentence case, one idea per paragraph, verb-first CTA. The tone rule from the design system — *a well-informed local friend, not a marketplace* — applies to email as much as to the interface.

### The privacy rule, again

`reportAcknowledged` says a report was received and nothing else. Not the outcome, not the target's state, not whether anyone acted. §6 is explicit, and email is the easiest place to leak it by being helpful.

### Delivery

Queue, do not send inline. An SMTP timeout inside an admin action must not roll back the moderation decision:

```java
@Transactional
public void approve(Listing l, User admin) {
    transitions.transition(l, PUBLISHED, admin);
    audit(admin, "APPROVE_LISTING", LISTING, l.getId(), null);
    notifications.listingApproved(l);   // enqueues; delivery is async
}
```

Reuse the outbox shape from phase 04 if it exists.

---

## 3. Rate limiting

Bucket4j with a Redis or Postgres backend. Limits per authenticated user, and per IP for unauthenticated routes.

| Route | Limit | Why |
| --- | --- | --- |
| `POST /reports` | 10/day | Report-spam is the abuse the auto-flag threshold invites |
| `POST /conversations/{id}/messages` | 60/hour | Message-flooding |
| `POST /conversations` | 20/day | Contact-spam across many listings |
| `POST /listings` | 10/day | Draft-spam |
| `POST /listings/{id}/photos` | 100/day | Storage abuse |
| `POST /users` | 5/hour per IP | Signup-spam |
| `GET /listings` | 300/hour per IP | Scraping |

Return **429** with the standard envelope and a `Retry-After` header:

```java
throw new ApiException(429, ErrorCode.RATE_LIMITED, "Trop de requêtes, réessayez plus tard");
```

The reporting limit deserves attention: three distinct reporters auto-suspend a listing, so a small coordinated group can suppress a competitor. Rate limiting does not solve that — reporter-reliability weighting would, and §9 defers it. **Know that this attack is open**, and watch the auto-flag rate in production.

---

## 4. The fuzzing and privacy review

Not a checkbox. Sit down and audit every path that could carry a coordinate or a private field.

### Coordinates

Every endpoint returning listing data:

- [x] `GET /listings` — search
- [x] `GET /listings/{id}` — public branch, and confirm the owner branch is genuinely owner-only
- [x] `GET /listings/map` — highest risk, renders location directly
- [x] `GET /listings/featured`
- [x] `GET /favorites`
- [x] Conversation listing context (phase 04) — response contains only listing/user IDs, not coordinates or private fields
- [x] **Rendered HTML from phase 08** — page source, JSON-LD, any `__NEXT_DATA__` hydration payload
- [x] Sitemap
- [x] Admin endpoints — exact coordinates are correct here; confirm they are role-gated

The Next.js hydration payload is the one people miss. A Server Component that fetches a full listing object serializes it into the HTML, so an exact coordinate can leak into page source even when the visible component never renders it. **Fetch the public DTO server-side, not the entity.**

A mechanical check, worth having in CI:

```java
@Test void noPublicEndpointSerialisesExactCoordinates() {
    for (String path : PUBLIC_LISTING_PATHS) {
        String json = get(path).asString();
        assertThat(json).doesNotContain("\"latitude\"")
                        .doesNotContain("\"longitude\"");
    }
}
```

Also confirm distances are rounded to ~100 m, or radius queries let an attacker triangulate past the fuzzing.

### Private fields

Audit every DTO for `email`, `phone`, `firebase_uid`, internal `status`, `deleted_at`, `rejection_reason` on non-owner paths, and reporter identity anywhere near a reported user.

The audit is complete for the current API. Public listing/profile DTOs omit
email, phone, Firebase UID, moderation status, deleted timestamps, and
rejection reasons. Owner and admin DTOs retain the fields needed by their
authenticated workflows. Regression tests cover the public JSON and exact
coordinate absence across search, map, detail, featured, and favorites.

### Soft-delete

Confirm every user-facing API read path filters `deleted_at IS NULL`: search, favorites,
profiles, conversations, report targets, and moderation queues. Preserve deliberate
historical reads for account-deletion cascades, moderation history, notification delivery,
and authentication-token rejection. No Firestore mirror exists in the current API; backup
creation and restore are separate launch work.

---

## 5. Input validation and size limits

Keep limits at both the transport and domain boundaries. The servlet multipart backstop is
slightly larger than the domain's 5 MB image rule so ordinary upload errors can use the standard
French validation envelope. Every JSON write DTO must constrain user-controlled strings and
collections before service code runs.

The current API enforces:

- 4,000 characters for conversation opening messages and individual messages
- 20 amenity codes per listing, with each code limited to 64 characters
- non-blank moderation action names and a required conversation target
- 5 MB per image, 20 active photos per listing, minimum 200 px dimensions, and maximum
  10,000 px per axis or 40 megapixels overall
- 6 MB per multipart file and 8 MB per multipart request at the servlet boundary

The 20-photo cap protects storage while image resizing policy remains a product decision. Do not
silently broaden a limit in a controller: update the request constraint, domain guard, user-facing
validation message, and focused regression test together.

## 6. Operations

**Backups.** The production backup, retention, restore-drill, and incident
ownership policy is documented in [`docs/PRODUCTION_OPERATIONS.md`](../../docs/PRODUCTION_OPERATIONS.md).
Daily `pg_dump` archives are offsite and encrypted, with 35 daily, 12 weekly,
and 12 monthly copies. Use the custom format so the archive can be checked with
`pg_restore` before it is needed:

```powershell
docker exec dari-db pg_dump -U dari -d dari -Fc -f /tmp/dari-backup.dump
docker cp dari-db:/tmp/dari-backup.dump .\dari-backup.dump
```

Restore one into a clean `postgis/postgis:16-3.4` scratch environment and validate both application
tables and the PostGIS extension:

```powershell
docker run --name dari-db-restore-validation `
  -e POSTGRES_DB=dari -e POSTGRES_USER=dari -e POSTGRES_PASSWORD=restore_validation `
  -d postgis/postgis:16-3.4

# Wait for "PostgreSQL init process complete; ready for start up" in
# `docker logs dari-db-restore-validation` before running pg_restore. `pg_isready`
# can report success while the image's PostGIS init scripts are still running.
docker cp .\dari-backup.dump dari-db-restore-validation:/tmp/restore.dump
docker exec dari-db-restore-validation pg_restore -U dari -d dari `
  --no-owner --exit-on-error /tmp/restore.dump
docker exec dari-db-restore-validation psql -U dari -d dari -v ON_ERROR_STOP=1 `
  -c "SELECT count(*) FROM users; SELECT count(*) FROM listings; SELECT count(*) FROM flyway_schema_history; SELECT postgis_full_version();"
docker rm -f dari-db-restore-validation
```

Run `cd apps/api && ./mvnw test` after the restore validation. The restore check is complete only
when `pg_restore` exits successfully, representative application tables and Flyway history are
queryable, PostGIS is available, and the scratch container is removed. Keep backup storage and
credentials outside the repository. Firestore mirror work is out of scope for this procedure.

**Metrics** worth alerting on:

| Metric | Why |
| --- | --- |
| Search p95 latency | The busiest, most complex query |
| Moderation queue depth | Product health; a growing queue means listings are not going live |
| Reports per day | Abuse signal |
| Auto-flag rate | Spikes suggest coordinated reporting |
| Mirror drift | If phase 04 built one |
| Failed notification deliveries | Silent moderation is worse than none |
| 5xx rate, by endpoint | Standard |

**Load test the search path** — it is the busiest and most complex query in the system. Realistic filter mixes at 100k listings. Verify the phase 02 and 07 query plans hold under concurrency, not just in isolation.

**Deployment.** Follow [`docs/PRODUCTION_OPERATIONS.md`](../../docs/PRODUCTION_OPERATIONS.md):
deploy immutable artifacts, take a verified pre-deploy backup, run
backward-compatible Flyway migrations, and keep the previous release available
for fast application rollback. Expand-then-contract for column changes: add,
backfill, switch reads, drop in a later release. Destructive changes require an
explicit restore decision rather than deleting Flyway history.

---

## 7. Launch readiness

**Two end-to-end passes on a production-like environment**, done by hand, not by a test suite:

*Seeker:* signup → verify email → search → filter → open listing → favorite → contact → exchange messages → report something.

*Owner:* signup → create listing through all 8 steps → submit → (admin approves) → see it live → answer a message → mark room found → reopen → renew after expiry.

**Moderator runbook.** What each report reason usually means, when to warn versus suspend, what "unauthorized broker" looks like in practice, how to handle a suspected coordinated reporting attack. Currently that knowledge exists only in your head, and it is the operational core of the product.

**Legal pages.** Terms, privacy policy, and an accurate description of what happens to location data. The privacy policy must match what the code does — including that exact coordinates are stored and shown to admins, which is a real disclosure obligation and not a detail to gloss.

**Accessibility pass** to the standard already set: 360px, visible focus, WCAG AA, `prefers-reduced-motion`, keyboard-only paths through signup, search, contact and the wizard.

---

## 8. Done checklist

- [ ] Listings expire at 60 days, warned at 53; renewal re-enters review
- [ ] Every notification delivers, in French, following the copy rules
- [ ] Rate limits hold under a deliberate abuse attempt
- [x] **No public endpoint or rendered page exposes an exact coordinate or private field** — reviewed, not assumed
- [x] A backup has been restored and tested
- [x] Production backup storage, retention, and deployment rollback are documented
- [ ] Search holds under load at 100k listings
- [ ] Both end-to-end journeys pass by hand
- [ ] Moderator runbook exists
- [ ] Legal pages match actual behavior

## The honest risk

This phase has no user-visible features, which makes it the easiest to defer and the most expensive to skip. The items here are what stand between a working demo and something you can responsibly put real people's home addresses into.
