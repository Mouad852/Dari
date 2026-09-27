# Guide — Phase 06: Moderation, reporting and the admin console

Implementation guide for [`06-moderation-and-admin.md`](../06-moderation-and-admin.md).

This is the phase that closes the loop. Until it ships, listings reach `PENDING_REVIEW` and stop — nothing can approve them, and no listing has ever been publicly visible.

On a platform whose core promise is protection from scams and unauthorized brokers, **the moderation system is the product.** It deserves the same care as the search path, not admin-panel treatment.

---

## 0. Decisions to settle first

**Restoring after a dismissed auto-suspension → read `prior_status`, added in phase 02.** A `PENDING_REVIEW` listing that gets auto-suspended and then dismissed must return to `PENDING_REVIEW`, not `PUBLISHED`. Hard-coding the restore target is a real bug that publishes unreviewed listings.

**Notification delivery → stub the interface here, implement in phase 10.** Phase 06 needs owners to learn why their listing was rejected. Define `NotificationService` now with a logging implementation, wire every call site, and swap in email later. Forgetting the call sites is the failure mode; the transport is easy.

**Distinct reports → distinct *reporters*.** §6 says "3 distinct reports". One user filing three times must not trip the threshold, and the one-pending-report-per-reporter rule already prevents it — but assert it in a test, because it is the obvious abuse.

---

## 1. Schema

`V9__reports.sql`:

```sql
CREATE TYPE report_target AS ENUM ('LISTING','USER');
CREATE TYPE report_reason AS ENUM (
    'SCAM','FAKE_LISTING','WRONG_INFO','SUSPICIOUS_PRICE','PROPERTY_DOESNT_EXIST',
    'MISLEADING_PHOTOS','DUPLICATE','UNAUTHORIZED_BROKER','OTHER');
CREATE TYPE report_status AS ENUM ('PENDING','REVIEWED','ACTION_TAKEN','DISMISSED');

CREATE TABLE reports (
    id          UUID PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES users(id),
    target_type report_target NOT NULL,
    target_id   UUID NOT NULL,          -- not an FK: resolved at the application layer (§3)
    reason      report_reason NOT NULL,
    details     TEXT,
    status      report_status NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One PENDING report per reporter per target (§6). Partial unique index:
-- resolved reports do not block a later re-report.
CREATE UNIQUE INDEX idx_reports_one_pending
    ON reports (reporter_id, target_type, target_id) WHERE status = 'PENDING';

CREATE INDEX idx_reports_target ON reports (target_type, target_id, created_at DESC);
CREATE INDEX idx_reports_queue  ON reports (status, created_at) WHERE status = 'PENDING';

CREATE TABLE admin_actions (
    id          UUID PRIMARY KEY,
    admin_id    UUID NOT NULL REFERENCES users(id),
    action      TEXT NOT NULL,
    target_type report_target NOT NULL,
    target_id   UUID NOT NULL,
    reason      TEXT,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_actions_target ON admin_actions (target_type, target_id, created_at DESC);
```

Two notes:

**The partial unique index is the whole spam-prevention rule**, enforced by Postgres rather than by a service-layer check that races under concurrent submits.

**`target_id` is deliberately not a foreign key** (§3), since it points at two different tables. That means nothing stops a report against a nonexistent id — validate at the application layer on creation.

Also add to `users`, for the ban-evasion check:

```sql
CREATE TABLE banned_identities (
    id         UUID PRIMARY KEY,
    email_lower TEXT UNIQUE,
    phone       TEXT UNIQUE,
    user_id     UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

A separate table, not a flag on `users`, because the ban must outlive the row and block a *new* signup with the same email.

---

## 2. Auto-flagging

The rule (§6): **3 distinct reporters on one target inside a rolling 7-day window** → `SUSPENDED`, high priority in the queue.

```sql
-- Run after every report insert, in the same transaction.
SELECT COUNT(DISTINCT reporter_id)
FROM reports
WHERE target_type = :type
  AND target_id   = :id
  AND created_at  > now() - INTERVAL '7 days'
  AND status = 'PENDING';
```

`COUNT(DISTINCT reporter_id)` is the line that makes "distinct" real. Counting rows instead would let the rule be tripped by one determined user if the pending-uniqueness index were ever relaxed.

Restricting to `PENDING` is a judgement call worth stating: reports already dismissed by an admin should not contribute to a re-suspension, or a dismissed target gets re-flagged immediately by its own history.

```java
@Transactional
public Report create(User reporter, CreateReportRequest req) {
    validateTargetExists(req.targetType(), req.targetId());

    if (reports.existsPending(reporter.getId(), req.targetType(), req.targetId()))
        throw new ApiException(409, ErrorCode.ALREADY_REPORTED, "Signalement déjà en cours");

    var report = reports.save(Report.create(reporter, req));

    long distinct = reports.countDistinctReportersSince(
            req.targetType(), req.targetId(), Instant.now().minus(7, DAYS));

    if (distinct >= 3) autoSuspend(req.targetType(), req.targetId());
    return report;
}

private void autoSuspend(ReportTarget type, UUID id) {
    if (type == LISTING) {
        var listing = listings.findById(id).orElseThrow();
        if (listing.getStatus() == SUSPENDED) return;              // idempotent
        listing.setPriorStatus(listing.getStatus());               // phase 02 column
        listing.setStatus(SUSPENDED);
        listing.setAutoFlagged(true);
        notifications.listingSuspended(listing, AUTOMATIC);
    }
    // USER targets: suspend the user, cascade to their listings — see §4
}
```

Boundary tests that matter:

- 3 reports over 8 days → **not** suspended
- 3 reports from 1 reporter → not suspended (and blocked by the index anyway)
- 3 reports from 3 reporters in 7 days → suspended, `prior_status` captured
- A 4th report on an already-suspended target → no error, no double-suspend

---

## 3. The moderation queue

§6 requires reports **grouped by target**, one queue item per target, sorted auto-flagged first, then report count descending, then oldest first.

```sql
SELECT r.target_type,
       r.target_id,
       COUNT(*)                        AS report_count,
       COUNT(DISTINCT r.reporter_id)   AS reporter_count,
       MIN(r.created_at)               AS first_reported_at,
       ARRAY_AGG(DISTINCT r.reason)    AS reasons,
       BOOL_OR(l.auto_flagged)         AS auto_flagged
FROM reports r
LEFT JOIN listings l
       ON r.target_type = 'LISTING' AND l.id = r.target_id
WHERE r.status = 'PENDING'
GROUP BY r.target_type, r.target_id
ORDER BY auto_flagged DESC NULLS LAST,
         report_count DESC,
         first_reported_at ASC
LIMIT :limit OFFSET :offset;
```

Offset pagination is acceptable here, unlike public search — the queue is small, admin-only, and stability across pages matters less than simplicity.

### Reporter reliability

§6 wants reporter history shown alongside, to gauge whether a report is credible:

```sql
SELECT reporter_id,
       COUNT(*) FILTER (WHERE status = 'DISMISSED')    AS dismissed,
       COUNT(*) FILTER (WHERE status = 'ACTION_TAKEN') AS upheld,
       COUNT(*)                                        AS total
FROM reports
WHERE reporter_id = ANY(:reporterIds)
GROUP BY reporter_id;
```

Display only. §9 explicitly defers weighting the auto-flag threshold by reliability — resist implementing it, but note the schema already supports it when you want it.

---

## 4. Admin actions and cascades

```java
public enum ModerationAction {
    DISMISS, WARN_USER, SUSPEND_LISTING, REJECT_LISTING, SUSPEND_USER, BAN_USER
}
```

### Dismiss — the one with a trap

```java
case DISMISS -> {
    markReports(type, id, DISMISSED, admin);
    if (type == LISTING) {
        var l = listings.findById(id).orElseThrow();
        if (l.isAutoFlagged() && l.getStatus() == SUSPENDED) {
            // Restore what it WAS, not PUBLISHED. A PENDING_REVIEW listing that was
            // auto-suspended and then dismissed must go back to PENDING_REVIEW.
            l.setStatus(l.getPriorStatus());
            l.setPriorStatus(null);
            l.setAutoFlagged(false);
        }
    }
}
```

This is the single most consequential branch in the phase. Getting it wrong publishes unreviewed listings.

Note the guard on `isAutoFlagged`: a **manually** suspended listing must stay suspended when unrelated reports are dismissed. Only automatic suspensions are automatically reversible.

### Ban — the widest cascade

```java
@Transactional
public void banUser(User admin, UUID userId, String reason) {
    var user = users.findById(userId).orElseThrow();

    user.setStatus(BANNED);

    // Cascade: every listing suspended and soft-deleted (§6 — never hard-delete).
    listings.findByOwnerId(userId).forEach(l -> {
        l.setStatus(SUSPENDED);
        l.setDeletedAt(Instant.now());
    });

    // Messages soft-deleted, preserving the audit trail.
    messages.softDeleteBySender(userId, Instant.now());

    // Block re-registration on this identity (§6).
    bannedIdentities.save(BannedIdentity.of(user));

    audit(admin, "BAN_USER", USER, userId, reason);
    notifications.userBanned(user, reason);
}
```

If phase 04 chose the Firestore mirror, `softDeleteBySender` must emit outbox tombstones. A soft-delete that only applies to Postgres leaves the content live in Firestore — precisely the drift that matters.

### Enforcing the ban at signup

Phase 01's `POST /users` needs a new check:

```java
if (bannedIdentities.existsByEmailLower(principal.email().toLowerCase()))
    throw new ApiException(403, ErrorCode.IDENTITY_BANNED, "Inscription impossible");
```

Be honest about the limit: this stops casual re-registration, not a determined actor. Firebase identities are free and email aliases are trivial. It is a speed bump, not a wall — worth knowing rather than believing.

### Audit everything

```java
private void audit(User admin, String action, ReportTarget type, UUID id, String reason) {
    adminActions.save(AdminAction.of(admin, action, type, id, reason));
}
```

Every branch. An admin console without an audit log is unaccountable, and with a single `ADMIN` role there is nothing else keeping anyone honest.

---

## 5. Endpoints

```
POST   /api/v1/reports
GET    /api/v1/reports/me                                    status only

GET    /api/v1/admin/dashboard
GET    /api/v1/admin/listings?status=PENDING_REVIEW
POST   /api/v1/admin/listings/{id}/approve
POST   /api/v1/admin/listings/{id}/reject                    {reason}
GET    /api/v1/admin/reports                                 grouped queue
POST   /api/v1/admin/reports/{targetType}/{targetId}/action  {action, reason}
GET    /api/v1/admin/users
POST   /api/v1/admin/users/{id}/suspend
POST   /api/v1/admin/users/{id}/ban
```

Role-gate the whole admin tree in one place, not per method:

```java
http.authorizeHttpRequests(a -> a
    .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
    .anyRequest().permitAll());
```

### The privacy rule

§6: reporters are **never** told what action was taken. Easy to violate by returning too much:

```java
/** Deliberately minimal. No outcome, no target state, no admin identity. */
public record MyReportResponse(UUID id, ReportTarget targetType, ReportReason reason,
                               Instant createdAt, boolean resolved) {}
```

`resolved` is a boolean, not the status enum — `ACTION_TAKEN` versus `DISMISSED` is exactly the information being withheld.

### Keep admin and public paths separate

Per the §7 design note, `GET /admin/listings` is not `GET /listings` with a query param. It reads the `listings` table (not the `published_listings` view), returns reporter-sensitive data and exact coordinates, and none of that must ever be reachable from a public route. Separate controllers, separate DTOs.

---

## 6. Admin console — no mockups exist

**Density is the design decision here.** The design system's generous spacing is calibrated for consumers browsing rooms. This is a work tool someone uses for an hour at a time; the right instinct is closer to a trading terminal than to the marketing site.

Concretely: use `--space-3`/`--space-4` where consumer screens use `--space-6`/`--space-8`; `--text-body-sm` as the default body size; tables rather than cards for the queue. Keep the tokens — color, radius, type family — so it stays recognisably Dari. Do not invent a second design language.

### Screens

**Review queue** (`/admin/listings`) — `PENDING_REVIEW` listings with full detail: photos, all fields, owner, exact location. Approve, or reject with a reason. The reject reason goes straight to the owner's dashboard, so make it a required, substantive field, not a free-text afterthought.

**Report queue** (`/admin/reports`) — grouped items showing target, report count, distinct reporters, reasons, auto-flag badge, and per-reporter dismissal history. Six actions. Auto-flagged items visually first.

**User management** (`/admin/users`) — search by email or name, filter by status, view a user's listings and report history, suspend, ban.

**Dashboard** — pending review count, queue depth, reports in the last 7 days, auto-flagged count. These double as the operational metrics phase 10 wants.

Keyboard-first where it is cheap: `j`/`k` to move through the queue, `a` to approve, `r` to reject. A moderator clearing fifty items will feel it.

---

## 7. Tests

| Test | Asserts |
| --- | --- |
| **Create → submit → approve → appears in search** | The end-to-end path, first time it works |
| Reject with reason | Owner sees reason; resubmit returns to `PENDING_REVIEW` |
| 3 distinct reporters / 7 days | Auto-suspended, top of queue, `prior_status` captured |
| 3 reports from 1 reporter | Not suspended |
| 3 reports over 8 days | Not suspended |
| Auto-suspend a `PENDING_REVIEW` listing, then dismiss | Returns to `PENDING_REVIEW`, **not** `PUBLISHED` |
| Manually suspend, then dismiss unrelated reports | Stays `SUSPENDED` |
| Second pending report, same reporter+target | 409 |
| Ban user | Listings suspended and soft-deleted, messages soft-deleted, identity blocked |
| Banned email re-registers | 403 |
| `GET /reports/me` | No outcome leaked — assert the raw JSON |
| Non-admin hits `/admin/**` | 403 |
| Every action | Writes an `admin_actions` row |

The dismiss-restore test is the one to write first. It is the highest-consequence branch in the phase.

---

## 8. Done checklist

- [ ] The full loop works: create → submit → approve → visible in search
- [ ] Rejection reason reaches the owner; resubmission re-enters review
- [ ] Auto-flag fires on 3 distinct reporters in 7 days, and not otherwise
- [ ] Dismissal restores the prior state, never a hard-coded `PUBLISHED`
- [ ] Ban cascades to listings and messages, blocks re-registration
- [ ] A reporter can see status and learn nothing about the outcome
- [ ] Every admin action is audited
- [ ] A moderator can clear a 50-item queue without leaving the console
- [ ] **Written down:** the notification transport chosen, and whether it ships here or in phase 10

## Operational note

Every listing requires human approval. At launch volume that is fine; at ten times launch volume it is a full-time job. The queue tooling should assume the person using it is in a hurry — that is a design constraint, not a nice-to-have.
