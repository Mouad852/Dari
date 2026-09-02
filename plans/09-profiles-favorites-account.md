# 08 — Profiles, favorites and account

## What this covers, and why it's here

Favorites, public profiles, the account and settings area, and the profile-completion prompt.

It is deliberately late and deliberately small. None of it is architecturally risky, none of it blocks anything else, and all of it is genuinely optional to a first usable product — a seeker can find a room and message an owner without ever saving a favorite. Putting it here keeps it from displacing the moderation and search work that the product actually depends on.

It is not, however, zero-value: favorites are the main reason a seeker returns, and the public profile is what an owner judges a stranger by before replying. On an anti-scam platform, **the profile carries trust signals**, which makes it more load-bearing than it first appears.

**Status (2026-09-02): favorites is done end to end for its core loop.** Backend: migration, entity, repository, service, controller, 5 passing integration tests in `FavoriteApiTest`. Frontend: the `/favorites` route now fetches `GET /api/v1/favorites` for real (loading/empty/error states, cursor-paginated "Voir plus", optimistic remove-with-rollback on `DELETE`), and the listing detail page's heart button (previously local `useState` only, cosmetic) now calls `POST`/`DELETE /api/v1/favorites/{id}` with optimistic toggle-and-rollback, redirecting to `/sign-in` if there's no token. Verified via `npm run typecheck` and `npm run build` (both clean); not verified in a live browser — no browser automation tool was available in that session, and a real click-through needs a genuine Firebase ID token.

**Both gaps above closed same day (2026-09-02):**
- Added `GET /api/v1/favorites/ids` (unpaginated, just the listing ids) so a client can cheaply answer "is this one favorited?" without paying for the full paginated list. Covered by a new `FavoriteApiTest` case.
- The feed cards in `/listings` now have the same heart toggle as the detail page, backed by that endpoint (fetched once on page load into a `Set`, checked per card).
- The listing detail page no longer always starts unfilled — it checks `/favorites/ids` on load and reflects a prior favorite for real.
- Found and fixed in passing, same file, unrelated to favorites: **search-result cards had no link to the listing detail page at all** — clicking one did nothing. Now wrapped in a real link. See `plans/07-search-filters-and-map.md`'s 2026-09-02 status note.

**Status (2026-09-02): public profile and profile editing are now wired end to end.** Both backend endpoints were, like the admin console, already built by an earlier session and simply never checked off below — `GET /users/{id}` and `PATCH /users/me` have existed since phase 01. What was new: `/profile/[id]` (a Server Component, since it's public/unauthenticated content worth keeping crawlable, per `ARCHITECTURE.md`'s discovery rationale) now fetches the real profile and shows exactly the fields the backend returns — display name, city, bio, verification tier, member since, active listing count — dropping the mock's fabricated search-preference fields (budget/cities/move-in date), trust items (response time, review count) and the fake second "propriétaire" card, none of which have any backing data or field in the design doc. Its "Contacter" button (`ContactButton.tsx`, a small client component alongside the server-rendered page) starts a real conversation via `POST /conversations` with `otherUserId`, same pattern as the listing detail page's contact button. `/account/profile` is a real edit form now (firstName/displayName/city/bio, matching `UpdateUserRequest` exactly) that `PATCH`es on submit; email and phone are shown read-only and never included in the request body, since they're Firebase's to own, not this form's. Dropped the mock's fake avatar-upload camera icon (avatar upload is `POST /users/me/avatar`, still a phase-09 `NotImplementedYetException` stub) and its fake "search preferences" tag section (no such field exists on `User`). `npm run typecheck`/`npm run build` clean; no backend changes were needed so the existing backend test coverage stands.

**Also fixed same day (2026-09-02), same file as the sign-out wiring below**: the `/account` overview page's verification badge always read "Vérifié" regardless of the user's actual `VerificationTier` — fixed to use the real value via the existing `VERIFICATION_LABELS`. Its three stat tiles ("3 actives", "12 en cours", "8 sauvegardés") were also fully fabricated; now computed from real `GET /listings/mine`, `GET /conversations` and `GET /favorites/ids` calls (best-effort — a failure there doesn't block the rest of the page from rendering). The main "Se déconnecter" button had no `onClick` at all; added a `signOut()` export to `lib/firebase.ts` and wired it to redirect home afterward.

Everything else in this phase — the profile-completion prompt (deliberately left alone: "what counts as complete" is an open product decision per this file's own risk section, not something to invent a number for), account deletion, notifications, payments, avatar upload — is still open.

## Tasks

**Backend**
- [x] `favorites` migration, composite key on (user, listing) — `V13__favorites.sql`
- [x] `GET /favorites`, `POST /favorites/{listingId}`, `DELETE /favorites/{listingId}` — `FavoriteController`/`FavoriteService`, cursor-paginated, both writes idempotent (double-add and double-remove are no-ops, including under a concurrent race on add)
- [x] Decide what a favorited listing shows once it leaves `AVAILABLE` — it should stay in the list, marked unavailable, rather than vanishing. Resolved: the list reads `listings` directly (not the `published_listings` view), so SUSPENDED/EXPIRED/ROOM_FOUND stay visible with their real status; only a soft-deleted listing drops out. Covered by `FavoriteApiTest`.
- [x] `GET /users/{id}` public profile: display name, city, bio, verification tier, member since, active listings — built in phase 01, verified 2026-09-02
- [x] Make sure the public profile leaks nothing private — `PublicProfileResponse` structurally has no field that could hold an email/phone/status, per its own doc comment
- [x] `PATCH /users/me` for profile edits — built in phase 01, verified 2026-09-02; ignores email/phone by construction (`UpdateUserRequest` has no such fields)
- [ ] `POST /users/me/phone-verification` stubbed per §7, since phone verification is a fast-follow — still a stub, correctly so (post-MVP)

**Frontend**
- [x] Favorites screen — wired to the real API (see status note above); not ported from `ui_kits/mobile_app/FeedScreen.jsx`, built from the pre-existing mock's own layout instead
- [x] Empty state copy naming the action that fills it: *"Touchez le cœur sur une annonce pour la retrouver ici."*
- [x] Favorite toggle on cards, in the feed and on the listing header, with optimistic update — done everywhere: the listing header, the `/favorites` list itself, and the feed/search-result cards on `/listings`
- [~] Profile screen, from `ui_kits/mobile_app/ProfileScreen.jsx` — the real fields are wired (see status note); not ported from the mockup, and no "settings switches" exist since no such settings (notifications toggles, visibility toggle) exist on the backend
- [x] Public profile view as seen by another user — `/profile/[id]`, real data, real "Contacter" action
- [ ] Profile-completion prompt in the feed, per the mockup — not built; needs the "what counts as complete" decision this file's own risk section calls out below
- [~] Account settings: edit profile and sign out are done (`/account/profile`, and `/account`'s sign-out button now calls Firebase `signOut()` and redirects home); account deletion is not — `DELETE /users/me` is still a phase-09 backend stub, so there's nothing to wire yet

## Depends on

- Phases 01, 03, 05, 07
- Design doc §3 `favorites` and `users`, §7 Users and Favorites
- Mockups: `ProfileScreen.jsx`, `FeedScreen.jsx` (favorites empty state and completion prompt)
- Design system: `core/`, `forms/Switch`, `listings/ListingCard`

## Done looks like

- Favouriting from feed and detail, persisting across sessions and devices
- A favorited listing that becomes unavailable stays in the list, clearly marked
- The public profile shows trust signals and no private data — verified by fetching another user's profile directly and reading the raw response
- Profile edits round-trip; the completion prompt disappears when the profile is complete
- Sign out and account deletion behave sensibly against both Firebase and the internal row

## Risks and open decisions

- **Account deletion is not specified anywhere in the design doc.** It interacts with soft-delete, with the audit trail, and with GDPR-style expectations, and it needs an answer before launch: does deleting an account remove the Firebase identity, soft-delete the internal row, orphan the listings, or all three? Do not let this be decided by whatever the delete button happens to do.
- **"Verification tier" appears in §2 but is never defined** in the data model — `users` has `email_verified` and `phone_verified` booleans and nothing else. If the profile is meant to display a tier, that tier needs defining.
- **Phone verification is a fast-follow**, so the profile design should have room for a badge that does not exist yet.
- **The profile-completion prompt implies a completeness rule** nobody has written down. Decide what "complete" means before building the prompt that nags about it.
