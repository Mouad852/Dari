# Dari — Audit Fix & Improvement Plan

## Context

`docs/SOURCE_CODE_AUDIT.md` (dated 2026-09-15/16, HEAD `44b2fa8`) is an independent, code-verified
audit of the Dari marketplace (Spring Boot API + Next.js web). Every finding in it has now been
**re-verified against the current codebase** by three parallel exploration passes — all findings
are CONFIRMED with exact, current file:line evidence (not just the audit's original claims, which
could have drifted). This plan turns those confirmed findings into an executable, phased fix list.

Mouad applies every change by hand (per standing convention) — this file is documentation to work
from, not code to run. Re-run the existing verification harness after each phase: `./mvnw test`
(127 tests today) for backend changes, `npm run build` (29 routes) for frontend changes. Several
changes here (a new migration, a response-shape change, a new record field) are the kind that
silently break a downstream test or type-check without an obvious runtime symptom — don't skip
the re-run between phases.

Two items in the original audit needed a product decision before code could be written. Both are
now resolved:

- **Suspension enforcement (CRIT-1):** Mouad chose **partial/read-only restriction** — a suspended
  user keeps read access (browsing, viewing existing conversations) but is blocked from any
  mutating action (publishing, messaging, reporting, etc.).
- **Actuator/Prometheus exposure (F10):** Mouad chose **not to implement monitoring/Grafana for
  now** — this item is deferred with no code change; it's documented below for later reference
  only.

---

## Phase 1 — Must-fix before launch

### CRIT-1: Enforce SUSPENDED (read-only), add reactivation path

**1a. Enforce a read-only restriction for SUSPENDED users**
- File: `apps/api/src/main/java/ma/dari/api/common/auth/FirebaseAuthFilter.java`
- Add a new block right after the existing BANNED check (after line 83, before the `deletedAt`
  check at line 89):
  ```java
  if (user.isPresent() && user.get().getStatus() == UserStatus.SUSPENDED) {
      String method = request.getMethod();
      boolean readOnly = "GET".equalsIgnoreCase(method)
              || "HEAD".equalsIgnoreCase(method)
              || "OPTIONS".equalsIgnoreCase(method);
      if (!readOnly) {
          writeError(response, 403, ErrorCode.ACCOUNT_SUSPENDED, "Ce compte est suspendu (lecture seule)");
          return;
      }
      // Safe method: fall through and authenticate normally — suspended users
      // keep read access (browsing, viewing existing conversations), matching
      // UserStatus's own documented intent ("keeps conversation history reachable").
  }
  ```
- This is a coarse, HTTP-method-based gate (GET/HEAD/OPTIONS allowed, everything else blocked) —
  there's no existing read/write authorization axis in this codebase to hook into more precisely,
  so this is the pragmatic first pass. `ErrorCode.ACCOUNT_SUSPENDED` already exists
  (`ErrorCode.java:14`) and is currently unused — this is its only call site.
- **Edge case to decide during implementation:** should `DELETE /users/me` (self-account deletion)
  remain allowed for a suspended user? It's a mutating request but arguably shouldn't be blocked.
  If so, add a narrow method+path exception rather than loosening the general rule.
- Update the class Javadoc (lines 33–42) to add a third bullet describing the SUSPENDED/read-only
  behavior, next to the existing BANNED bullet.

**1b. Add `autoSuspended` to `User`, mirroring `Listing.autoFlagged`**
- File: `apps/api/src/main/java/ma/dari/api/user/User.java` — add:
  ```java
  @Column(name = "auto_suspended", nullable = false)
  private boolean autoSuspended = false;
  ```
  plus getter/setter, placed near the `status` field for locality.
- New Flyway migration `V22__user_auto_suspended.sql`:
  ```sql
  ALTER TABLE users ADD COLUMN auto_suspended BOOLEAN NOT NULL DEFAULT false;
  ```
  (Confirm `V21` is still the latest migration before naming this `V22` — check for any newer
  migration added since the audit. F1 below adds `V23` — pick both numbers together so two
  in-flight changes don't collide.)

**1c. Set the flag at both write sites**
- `ReportService.autoSuspendTarget()` (`ReportService.java:163-169`): alongside
  `user.setStatus(UserStatus.SUSPENDED)`, add `user.setAutoSuspended(true)`.
- `AdminService.suspendUser()` (`AdminService.java:316-331`): leave `autoSuspended` at its default
  `false` — a moderator's manual suspension is never "auto." Add a one-line comment explaining why,
  matching the existing comment style around `suspendListing`.

**1d. Add the USER branch to `resolvePendingReports`**
- File: `apps/api/src/main/java/ma/dari/api/moderation/ReportService.java`,
  `resolvePendingReports()` (lines 84-112). After the existing
  `if (targetType == ReportTarget.LISTING)` block (102-111), add:
  ```java
  if (targetType == ReportTarget.USER) {
      User user = users.findById(targetId)
              .orElseThrow(() -> new ApiException(404, ErrorCode.NOT_FOUND, "Utilisateur introuvable"));
      if (user.isAutoSuspended() && user.getStatus() == UserStatus.SUSPENDED) {
          user.setStatus(UserStatus.ACTIVE);
          user.setAutoSuspended(false);
          users.save(user);
      }
  }
  ```
  The `autoSuspended` guard is the whole point: dismissing the reports that triggered an
  auto-suspension restores `ACTIVE`, but dismissing reports against a user a moderator suspended
  manually does **not** silently undo that decision.
- Update the method's Javadoc (75-83) to mention the new USER case.

**1e. Reactivation endpoint + service method**
- `AdminService.java`: add `reactivateUser(User admin, UUID userId)`, same shape as `suspendUser`
  (316-331) — look up the user, no-op if already `ACTIVE` (matches `banUser`'s early-return
  idempotency style), otherwise set `status = ACTIVE`, `autoSuspended = false`, and record an
  admin-action audit row the same way every other action in this class does.
- `AdminController.java`: add, right after `suspend` (135-139):
  ```java
  @PostMapping("/users/{id}/unsuspend")
  public ResponseEntity<Map<String, String>> unsuspend(@CurrentUser User admin, @PathVariable UUID id) {
      adminService.reactivateUser(admin, id);
      return ResponseEntity.ok(Map.of("status", "ok"));
  }
  ```
  Also fix the `suspend` endpoint's Javadoc (line 134, currently `/** Reversible. ... */`) — it
  promises a reversal path; once `unsuspend` ships, the comment becomes true instead of aspirational.

**1f. Frontend: "Réactiver" action**
- File: `apps/web/src/app/admin/users/page.tsx`
- Add `handleReactivate(id)` mirroring `handleSuspend` (98-106) exactly, calling
  `POST /admin/users/{id}/unsuspend` and updating local state to `status: 'ACTIVE'`.
- In the render block (285-304), add a second conditional button:
  `user.status === 'SUSPENDED' ? <Réactiver /> : null`, alongside the existing
  `user.status !== 'SUSPENDED' ? <Suspendre /> : null`, matching existing icon/styling conventions.

**1g. Tests**
- Auth integration test: a SUSPENDED user's `GET` request succeeds; the same user's `POST` request
  gets 403 `ACCOUNT_SUSPENDED`. Add next to wherever the existing BANNED-403 test already lives.
- `ReportServiceTest` (or equivalent): 3 distinct reports auto-suspend a user
  (`autoSuspended = true`) → dismissing all three restores `ACTIVE`.
- Companion test: a **manually** suspended user (`autoSuspended = false`) stays `SUSPENDED` after
  reports against them are dismissed.
- `AdminControllerTest`/`AdminServiceTest`: coverage for the new `unsuspend` endpoint.

### F1: Duplicate DM conversation race

- Canonicalization is **already handled** — `Conversation`'s constructor (`Conversation.java:46-50,
  98-104`) normalizes participant order regardless of listing presence, and
  `ConversationService.create()` (88-92) computes `min`/`max` before the lookup. No new
  canonicalization logic needed — the gap is purely (1) no DB constraint for the
  `listing_id IS NULL` case, and (2) no catch around the insert.
- New migration `V23__conversations_unlisted_pair_unique.sql`:
  ```sql
  CREATE UNIQUE INDEX idx_conversations_unlisted_pair
      ON conversations (participant_a_id, participant_b_id)
      WHERE listing_id IS NULL;
  ```
- File: `ConversationService.java`, `create()` (74-101, specifically the `orElseGet` save at line
  94). Wrap it in the same try/catch pattern already proven in `FavoriteService.add()`
  (`FavoriteService.java:91-105`):
  ```java
  Conversation conversation;
  if (existing.isPresent()) {
      conversation = existing.get();
  } else {
      try {
          conversation = conversations.save(new Conversation(listing, currentUser, otherUser));
      } catch (DataIntegrityViolationException lostRace) {
          conversation = (listing == null
                  ? conversations.findByParticipantPairWithoutListing(min(first, second), max(first, second))
                  : conversations.findByListingAndParticipantPair(listing.getId(), min(first, second), max(first, second)))
                  .orElseThrow(() -> lostRace);
      }
  }
  ```
  Import `org.springframework.dao.DataIntegrityViolationException` (already used in
  `FavoriteService.java:9`). Adjust whatever `created` flag the method returns so the race-lost
  branch reports `false` (someone else created it).
- Test: a concurrency test using the existing `AbstractIntegrationTest` harness (see
  `ListingSearchOptimizationTest`'s `@BeforeEach` for the established style) — two calls to
  `ConversationService.create()` for the same unlisted pair, asserting exactly one row exists and
  neither caller sees an unhandled exception.

---

## Phase 2 — Important (performance, scalability, architecture gap)

### F2: N+1 in conversation inbox

- File: `MessageRepository.java` — add two batch queries next to the existing single-conversation
  ones (14-77):
  - `findLatestByConversationIdIn(Collection<UUID> conversationIds)` — "latest row per group."
    Postgres is already assumed project-wide (migrations use Postgres-only syntax), so a native
    `DISTINCT ON (conversation_id) ... ORDER BY conversation_id, sent_at DESC, id DESC` query is the
    cleanest fit.
  - `countUnreadByConversationIdIn(Collection<UUID> conversationIds, UUID userId)` — grouped count,
    returned as a small projection (e.g. `record UnreadCount(UUID conversationId, long count)`).
- File: `ConversationService.java`, `list()` (44-72) and `toConversationResponse()` (190-209):
  build two maps once (`Map<UUID, Message>`, `Map<UUID, Long>`) after fetching `pageRows`, exactly
  the shape `ListingCovers.forEach()` (`ListingCovers.java:45-55`) already uses and that
  `ListingService.listMine()` / `AdminService.pendingListings()` already consume. Pass the maps
  into `toConversationResponse` instead of querying per row.
- Verify: existing conversation tests should pass unchanged (same response shape). Consider a
  query-count assertion using whatever mechanism `ListingSearchOptimizationTest` already uses.

### F3: Unbounded/unpaginated admin user search (+ bonus N+1 at line 107)

- File: `UserRepository.java` (currently 4 finders, no `Pageable`/`Specification` support). Add a
  keyset-paginated query mirroring `ListingRepository.findVisibleByOwner`/`...After`
  (`ListingRepository.java:64-77`):
  ```java
  @Query("""
          select u from User u
          where u.deletedAt is null
            and (:status is null or u.status = :status)
            and (:needle is null or lower(u.email) like :needle or lower(u.displayName) like :needle)
          order by u.createdAt desc, u.id desc
          """)
  List<User> searchVisible(@Param("status") UserStatus status, @Param("needle") String needle, Pageable pageable);
  ```
  plus an `...After(...)` sibling taking `lastCreatedAt`/`lastId`. Before calling this "done," run
  `EXPLAIN` under Postgres — `lower(column) like` on an unindexed column can still full-scan; if
  search volume matters, flag a `pg_trgm` trigram index as a fast-follow (out of scope for this fix).
- File: `AdminService.java`, `searchUsers()` (98-109): replace the `findAll().stream()...` pipeline
  with the new repository call, returning `CursorPage<AdminUserResponse>` (same shape as
  `ConversationService.list()`/`FavoriteService.list()`) instead of a flat `List`.
- Fix the bonus N+1 at line 107 (`reports.countByTargetTypeAndTargetId(...)` per row) in the same
  pass — see F5 below for the identical batching shape; add
  `ReportRepository.countByTargetTypeAndTargetIdIn(...)`, build one `Map<UUID, Long>` over the
  page's user IDs.
- File: `AdminController.java`, `users()` (128-132): add a `cursor` param, change the return type
  to `CursorPage<AdminUserResponse>`.
- Frontend: `apps/web/src/app/admin/users/page.tsx` needs to consume a cursor-paginated response
  instead of a flat array — check how another page already consumes `CursorPage<T>` (e.g. messages
  or favorites) and mirror that existing convention.
- Test: extend `AdminServiceTest`/`AdminControllerTest` for pagination + the batched count.

### F5: Minor N+1 in moderation report queue

- File: `AdminService.java`, `pendingReportQueue()` (111-149), `targetLabel()` (160-165),
  `isAutoFlagged()` (167-172).
- Before the `.map(entry -> ...)` stream (line 129), group target IDs by type across
  `grouped.values()`, then do two batch lookups with plain `JpaRepository.findAllById(...)` (no new
  repository method needed):
  ```java
  Map<UUID, Listing> listingsById = ...; // findAllById(listingIds) -> toMap
  Map<UUID, User> usersById = ...;       // findAllById(userIds) -> toMap
  ```
  Rewrite `targetLabel`/`isAutoFlagged` to read from these maps (or inline the lookups directly and
  drop the two private methods).
- Same fix shape as F3's bonus issue — if both land together, a tiny shared "batch-lookup grouped
  by type" helper may pay for itself, but don't force it for two call sites.
- Test: extend existing `pendingReportQueue` coverage to assert correctness post-change.

### F9: Missing ArchUnit rule

- File: `apps/api/src/test/java/ma/dari/api/support/ArchitectureTest.java` (39 lines). The class
  Javadoc (10-18) promises "no query outside the listing package may read the listings table
  directly," but no such rule exists — only two unrelated ones (`controllersDoNotReturnEntities`,
  `commonDependsOnNoFeature`).
- **Verify before writing the rule, not after:** `AdminService` (in the `moderation` package)
  directly injects and calls `ListingRepository` throughout (e.g. for `pendingListings`,
  `approveListing`/`rejectListing`, `suspendListing`). A naive rule —
  `noClasses().that().resideOutsideOfPackage("..listing..").should().accessClassesThat().haveSimpleName("ListingRepository")`
  — **will almost certainly fail immediately** against existing, legitimate code, not just catch
  future violations.
- Two ways to resolve this, pick one after checking a scratch run of the rule:
  1. **Narrow the rule to match what's true today** — e.g. restrict it to `@RestController` classes
     outside `..listing..` (forcing controllers through services, which is already the real
     pattern), rather than all classes. Weaker than the Javadoc's stated intent, but accurate and
     enforceable immediately.
  2. **Do the larger refactor first** — move `AdminService`'s listing-status-transition calls behind
     a listing-package service method, then write the rule as originally intended. This is a real
     scope increase beyond "add a test" — decide only after confirming how much `AdminService`
     currently touches `ListingRepository` directly.
- ArchUnit 1.4.0 / `archunit-junit5` is already a test-scope dependency (`pom.xml:34,151-156`); use
  the existing field-based `@ArchTest` + `ArchRuleDefinition.noClasses()` style.
- Manual check (not committed): temporarily add a throwaway direct `ListingRepository` call from an
  unrelated package, confirm the finished rule fails the build, then remove it.

---

## Phase 3 — Hardening (low-priority correctness/perf/resource)

### F7: Sitemap `lastModified` always equals `createdAt`

- File: `PublicListingResponse.java` — add `Instant updatedAt` to the record (7-22), pass
  `listing.getUpdatedAt()` in `from()` (32-44). Confirm `Listing` exposes `getUpdatedAt()` first
  (very likely, via the entity's `@PreUpdate` timestamp, same pattern as `User.java`).
- No call-site signature changes needed for `.from()` — `ListingSearchService.java:65,349,363` and
  `FavoriteService.java:39` all pass the same `listing` object already; only the record body needs
  the new field wired in.
- Also update `PublicListingDetailResponse.java`'s separate `.from()` (line 42) for consistency,
  even though it's not directly in the sitemap's path.
- Frontend: `apps/web/src/types/api.ts`, `PublicListing` interface (79-96) — add
  `updatedAt: string;` next to `createdAt`.
- File: `apps/web/src/app/sitemap.ts` — line 51 currently does
  `rows.push({ id: item.id, updatedAt: item.createdAt })`; change to `item.updatedAt`. Line 82
  (`lastModified: new Date(listing.updatedAt)`) needs no change — it already reads the right field
  name, it's just been fed the wrong value.
- Test: a backend test asserting `PublicListingResponse.from(...).updatedAt()` changes after an
  edit; manually re-check sitemap output after an edit+republish (Next.js server component, no
  existing automated sitemap test).

### F4: Unbounded in-memory rate-limit map

- File: `RateLimitService.java`. Confirmed: **Caffeine is not currently a dependency**
  (`apps/api/pom.xml` has no `caffeine` artifact) — so default to a **scheduled sweeper**, not a
  Caffeine cache swap, to avoid pulling in a new dependency for one bounded map.
- Check whether `@Scheduled`/ShedLock is already wired elsewhere (the presence of
  `V16__shedlock.sql` strongly suggests yes) and reuse that exact convention rather than
  introducing a second scheduling style. Add a method that iterates `windows.entrySet()` and
  removes entries older than the longest configured policy window (computable once from the
  `policies` map at construction), run every few minutes.
- Update the class Javadoc (11-18) to state the bounded-memory guarantee explicitly — it currently
  only documents the single-instance/distributed-store caveat, not this specific fix.
- Test: a unit test asserting the map shrinks after the sweep runs past the eviction threshold
  (short window + injected/advanced clock if `Window`/`RateLimitService` supports one; otherwise
  add a minimal injectable clock).

---

## Phase 4 — Deferred / no action

### F10: Actuator `/metrics` and `/prometheus` — **deferred, no implementation now**

Confirmed as claimed: `application.yml:64-71` exposes `metrics,prometheus`, but
`SecurityConfig.java:69` only `permitAll()`s `/actuator/health` and `/actuator/info`, so both
require a Firebase bearer token today. **Per Mouad's decision, monitoring/Grafana is not being set
up right now — no code change.** Documented for later:
- Option A (bind actuator to a separate internal `management.server.port` — bypasses the public
  security chain entirely, no `SecurityConfig` change) or
- Option B (`permitAll` `/actuator/prometheus` paired with network/firewall-level restriction)
  are the two realistic paths whenever monitoring is actually stood up. Revisit this section then.

### F6: Phone verification stub — no action

`UserController.java:105-110` throws `NotImplementedYetException("post-MVP")` deliberately. Only
revisit if/when phone verification becomes a real product priority.

### F8: No `next/image` usage — optional/future, not scheduled

8 raw `<img>` occurrences across `ListingThumb.tsx`, `SiteNav.tsx`, `publish/page.tsx`,
`ListingGallery.tsx`, `account/profile/page.tsx`, `ds/ListingCard.tsx` (×2), `messages/[id]/page.tsx`.
`apps/web/next.config.*:10`'s comment ("Photo hosts must be allowlisted for next/image. Phase 05's
storage choice...") suggests this was already considered and deliberately deferred pending a
storage/CDN decision — check that config before touching anything. If/when picked up, start with
the highest-traffic surfaces (`ds/ListingCard.tsx`, `ListingThumb.tsx`, `ListingGallery.tsx`)
before the lower-traffic pages. Defer until there's a measured page-weight/LCP concern, per the
audit's own recommendation — don't schedule this proactively.

---

## Sequencing summary

1. **Phase 1** (before launch): CRIT-1 and F1 — independent of each other, either order, both
   required before launch.
2. **Phase 2** (important): F2, F3 (+ its F5 bonus), F9 — resolve F9's rule-scoping question early
   in this phase so it doesn't force a rework after F2/F3 land.
3. **Phase 3** (hardening): F7, F5 (if not already folded into Phase 2), F4.
4. **Phase 4**: no code work — F10 explicitly deferred, F6 intentionally unimplemented, F8 optional
   future work.

Re-run `./mvnw test` and `npm run build` after each phase, not only at the end.

### Critical files (most-touched across this plan)
- `apps/api/src/main/java/ma/dari/api/common/auth/FirebaseAuthFilter.java`
- `apps/api/src/main/java/ma/dari/api/moderation/ReportService.java`
- `apps/api/src/main/java/ma/dari/api/moderation/AdminService.java`
- `apps/api/src/main/java/ma/dari/api/messaging/ConversationService.java`
- `apps/api/src/main/java/ma/dari/api/user/UserRepository.java`
- `apps/web/src/app/admin/users/page.tsx`

## Verification

- Backend: `./mvnw test` after every phase (currently 127 tests, exit 0) — add the new tests listed
  per finding above as you implement each fix, not at the end.
- Frontend: `npm run build` after every phase (currently 29 routes, clean `tsc`/`tokens:check`).
- Manual/functional spot-checks:
  - CRIT-1: suspend a test user, confirm GETs succeed and POSTs 403; dismiss the 3 reports that
    triggered an auto-suspension and confirm the user returns to ACTIVE; suspend a user manually
    and confirm dismissing unrelated reports does *not* reactivate them; hit `/admin/users/{id}/unsuspend`.
  - F1: fire two concurrent `POST /conversations` (no `listingId`) for the same pair, confirm one row.
  - F2/F3/F5: enable SQL logging, confirm query count drops for `/messages`, `/admin/users`,
    `/admin/reports`.
  - F7: edit and republish a listing, confirm the sitemap's `lastModified` changes.
  - F9: confirm the finished rule fails the build against a deliberately introduced violation.
