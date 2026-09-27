# 06 — Moderation, reporting, and the admin console

## What this covers, and why it's here

The reporting system, the auto-flagging threshold, the grouped moderator queue, all admin actions with their cascades, and the admin console UI.

It comes directly after listing creation because **it is the phase that closes the loop.** Right now listings can reach `PENDING_REVIEW` and go no further — nothing in the system can approve them. Until this phase ships, the product cannot put a single listing in front of a seeker.

It is also worth being blunt about what this phase is: on a platform whose core promise is protection from scams and unauthorized brokers, **the moderation system is the product**, not an admin afterthought. It deserves the same care as the search path.

## Tasks

**Reporting**
- [x] `reports` migration, with the full §3 reason enum and status enum (`V9__reports.sql`) — was built long before this box was ticked; corrected 2026-09-02
- [x] `POST /reports`; `GET /reports/me` returning status only, never the outcome — built, and now reachable from the product (see the report UI below). `POST /reports` also rejects self-reports (400): reporting your own listing or profile is never a real report, and the auto-suspend threshold counts *distinct* reporters so it could only ever be queue noise
- [x] Enforce one pending report per reporter per target — 409 `ALREADY_REPORTED`, covered by `ReportApiTest`
- [x] Report flow UI on listings and profiles (2026-09-02) — `src/components/ReportDialog.tsx`: reason picker from the existing `REPORT_REASON_LABELS`, details field required only for `OTHER` (capped at the DTO's 2000 chars), generic acknowledgment that states no outcome. Entry points on `/listings/[id]` and `/profile/[id]`. No mockup existed, so it follows the app's established form and card token usage rather than inventing a new visual language.

**Auto-flagging**
- [x] 3 distinct reports on one target inside a rolling 7-day window → `status = SUSPENDED`, high priority in the queue — implemented in `ReportService` and covered by `ReportApiTest`; corrected 2026-09-02
- [ ] *Distinct* means distinct reporters — write the test that proves one user cannot trip it alone
- [x] Record the pre-suspension state, so a dismissal can restore it — `prior_status` on the listing, set by both the auto-suspend path and a moderator's deliberate SUSPEND. A moderator's suspension leaves `auto_flagged` false, so a later DISMISS restores only what the *system* took down and never republishes what a human removed. `AdminApiTest.dismissDoesNotUndoDeliberateSuspension` pins that.
- [ ] Test the boundary properly: 3 reports across 8 days must not trigger it

**Admin — this whole section was already built by an earlier session and just never checked off; verified 2026-09-02 by reading `AdminController`/`AdminService` directly, not assumed**
- [x] `GET /admin/dashboard`; `GET /admin/listings?status=PENDING_REVIEW`
- [x] `POST /admin/listings/{id}/approve` and `/reject` with a rejection reason
- [x] `GET /admin/reports` — grouped by target, one queue item per target
- [x] Queue ordering: auto-flagged first, then report count descending, then oldest first
- [x] Reporter history shown per queue item (2026-09-02) — `AdminReportQueueItem.priorDismissedReports` counts reports these same reporters have previously had dismissed, so three reports from people who are usually wrong read differently from three from first-time reporters. Shown as a badge on the row.
- [~] `POST /admin/reports/{targetType}/{targetId}/action` supports `DISMISS`, `SUSPEND` and `BAN` with real state changes and audit rows. `BAN` is restricted to user targets. `WARN` still returns 400 `NOT_IMPLEMENTED` because notification delivery is not implemented yet. Reject-as-a-report-action remains intentionally absent.
- [x] `GET /admin/users` — search by query and status
- [x] `POST /admin/users/{id}/suspend` and `POST /admin/users/{id}/ban`
- [x] Cascades: banning a user soft-deletes and suspends all their listings (suspending a user does not cascade — a suspension is meant to be reversible and conversations stay reachable, so the design doc's cascade rule reads as ban-only in the actual code)
- [x] Ban blocks the associated email from re-registering via `BannedIdentity`/`bannedIdentities.existsByEmailLower` — phone blocking not applicable, there is no phone-based registration path
- [x] Soft-delete on ban, never hard-delete
- [ ] Owner notifications on suspension, rejection and reinstatement — not built (phase 10, `NotificationService` is still an unimplemented interface)
- [x] Reporters are never told the outcome — `GET /reports/me` returns status only
- [x] Audit log of every admin action (`AdminAction`/`AdminActionRepository`), actor + target + timestamp
- [x] Admin path kept separate: `/api/v1/admin/**`, `hasRole('ADMIN')` at both the URL-matcher level (`SecurityConfig`) and `@PreAuthorize` on the controller

**Admin console frontend — wired 2026-09-02**
- [x] Role-gated admin area — `apps/web/src/app/admin/layout.tsx`, a client-side layout wrapping every `/admin/*` route: fetches `/users/me`, redirects a non-admin to `/` and a signed-out visitor to `/sign-in` before they see anything. The real gate is still server-side (every `/api/v1/admin/**` route already required `ADMIN` before this session touched anything); this layout exists purely so a non-admin doesn't land on a page full of 403s.
- [x] Review queue for `PENDING_REVIEW` listings — full detail via a real fix, not a workaround: `GET /listings/{id}` previously 404'd for anyone but the owner or the public (published+available) viewing a listing, which is every pending-review listing an admin needs to open. Fixed `ListingSearchService.getPublicOrOwnerListing` to also allow an `ADMIN` viewer through, so the "Voir l'annonce" link actually works. Approve and reject (with a required reason, captured via `window.prompt` — no dialog component exists yet) both call the real endpoints.
- [~] Grouped report queue — real data and real dismiss/suspend/ban actions. Reporter dismissal history is shown. Target names are best-effort: listing targets fall back to a truncated id when unavailable, while user targets use the admin single-user lookup where available and otherwise fall back to a truncated id. Report warnings remain blocked on notification delivery.
- [x] User management: search by query, suspend, ban (with an optional reason and a confirm dialog before a ban, since it's irreversible)

## Depends on

- Phases 01, 02 (the lifecycle machine and its transition guard), 05 (something to moderate)
- Design doc §3 `reports`, §4 status transitions, §6 in full, §7 Reports and Admin
- Design system: `core/`, `forms/`, `feedback/`, `navigation/Tabs`. No mockups.

## Done looks like

- End to end, for the first time: create → submit → admin approves → **appears in public search**
- Rejection with a reason reaches the owner, who edits and resubmits
- Three distinct reporters inside 7 days auto-suspend a target and pull it to the top of the queue; the same reporter three times does not
- Dismissing an auto-suspension restores the previous state, not a hard-coded `PUBLISHED`
- Suspending a user cascades to their listings; banning blocks re-registration on that email
- A reporter can see their report's status and learn nothing about the outcome
- Every admin action is in the audit log
- A moderator can clear a realistic queue without leaving the console

## Risks and open decisions

- **Restoring state after a dismissed auto-suspension needs the prior state stored.** If it is not captured at suspension time it cannot be recovered — a `PENDING_REVIEW` listing auto-suspended and then dismissed must not land in `PUBLISHED`. Design this into the schema, not the service layer.
- **Ban-evasion blocking is weaker than it sounds.** Blocking an email and phone stops nothing determined — Firebase identities are free and email aliases are trivial. Worth knowing the limit rather than believing the feature.
- **Single `ADMIN` role, per §6.** Every admin can ban every user. Acceptable for a solo-operated MVP; revisit before anyone else is given access.
- **Notification delivery is unspecified** — email, in-app, or both. §6 requires owner notifications; nothing says how they arrive. Phase 09 has the infrastructure, so either stub it here and wire it there, or pull it forward.
- **The admin console has no design reference and is the largest un-mocked surface in the MVP.** Budget accordingly; it is easy to underestimate because it is unglamorous.
- **Moderation load is a real operational question.** Every listing needs human approval. At launch volumes that is fine; the queue tooling should assume it will not always be.
