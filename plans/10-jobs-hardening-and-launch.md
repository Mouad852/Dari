# 09 — Scheduled jobs, notifications, hardening and launch readiness

## What this covers, and why it's here

The scheduled expiry job, notification delivery, security hardening, observability, and everything that has to be true before real users arrive.

It is last among the web phases because most of it can only be done once the system it hardens exists. But **do not read "last" as "optional".** This phase contains the listing expiry job, without which §4's lifecycle is incomplete, and the notification delivery that phases 06 and 08 assume exists. Those are not polish.

There is a real risk that this phase gets compressed under launch pressure. The items most likely to be dropped — rate limiting, the security review of location fuzzing, the abuse paths — are precisely the ones an anti-scam platform cannot afford to drop.

## Tasks

**Scheduled jobs**
- [ ] `PUBLISHED → EXPIRED` after 60–90 days without update (§4). Confirm the exact window; the doc gives a range, not a number.
- [ ] Owner notification ahead of expiry, so it is not a surprise
- [ ] `EXPIRED → PENDING_REVIEW` on renewal, back through review rather than straight to published (§4)
- [ ] Make the job idempotent and safe to run twice — it will be, eventually
- [ ] Decide what "update" means for the expiry clock: any `PATCH`, or a deliberate renewal? A listing kept alive by trivial edits defeats the purpose.

**Notifications**
- [ ] Delivery mechanism — email at minimum, in-app if it earns its place
- [ ] The §6 set: suspension, rejection with reason, reinstatement, warnings
- [ ] Reporter acknowledgment that is **generic and reveals no outcome**
- [ ] Expiry warning and confirmation
- [ ] Templates in French, following the copy rules — no exclamation marks, no emoji, no *"Oups !"*

**Hardening**
- [ ] Rate limits on the abuse-prone routes: report creation, message sending, listing creation, signup
- [ ] **A dedicated review of location fuzzing across every endpoint**, including map, search, detail and any admin route that might be reachable publicly. One leak makes the whole scheme decorative.
- [ ] Audit every response DTO for private-field leakage — email, phone, exact coordinates, internal status, `firebase_uid`
- [ ] Confirm soft-delete is honoured everywhere, including the Firestore mirror if it exists
- [ ] Input validation and size limits across all write paths
- [ ] CORS, security headers, TLS
- [ ] Verify ownership and role checks on every mutating route, systematically rather than by memory

**Operations**
- [ ] Structured logging with correlation ids; error tracking
- [ ] Metrics on the things that indicate trouble: search latency, moderation queue depth, report volume, mirror drift
- [ ] Database backups, and **a restore actually tested** rather than assumed
- [ ] Deployment pipeline, migration strategy, rollback plan
- [ ] Load test on the search path, which is the busiest and most complex query in the system
- [ ] Seed the production amenity lookup and neighborhood lists as real reference data

**Launch readiness**
- [ ] End-to-end pass over the whole journey, twice: as a seeker and as an owner
- [ ] Moderator runbook — what to do with each queue item type
- [ ] Legal pages: terms, privacy, an accurate statement of what is done with location data
- [ ] Accessibility pass to the standard already set: 360px, visible focus, WCAG AA contrast, `prefers-reduced-motion`

## Depends on

- Every prior phase
- Design doc §4 expiry and renewal, §6 notifications and retention, §8 architecture

## Done looks like

- Listings expire on schedule, owners are warned first, and renewal re-enters review
- Every §6 notification is delivered, in French, following the copy rules
- Rate limits hold under a deliberate abuse attempt
- **No endpoint returns an exact coordinate or a private field** — verified by review, not assumption
- A backup has been restored into a scratch environment successfully
- Search holds up under a realistic load test
- Both end-to-end journeys pass on a production-like environment

## Risks and open decisions

- **Compression risk.** This is the phase most likely to be cut short, and its contents are the ones that matter most when things go wrong. Consider pulling the fuzzing review and rate limits forward if the schedule tightens.
- **The expiry window is a range, not a decision.** 60 versus 90 days is a product judgement about listing freshness.
- **Notification infrastructure may need to be earlier.** Phase 06 needs owner notifications to be genuinely usable; if that phase ships without them, moderation decisions land silently on owners. Stubbing there and completing here is fine — forgetting is not.
- **No email provider chosen.** Deliverability to Moroccan inboxes is worth a moment's research rather than defaulting.
- **Restoring backups is the classic untested assumption.** Test it.
