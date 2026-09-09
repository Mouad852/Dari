# 04 — Risk spike: messaging, and the Firestore decision

## Read this first

**The design doc does not describe Firestore message mirroring.** §7 defines five REST messaging endpoints; §8 shows Postgres as the only datastore and Firebase as identity only. There is no mention of Firestore, realtime, websockets, or mirroring anywhere in it.

You named this as a risk to validate early, so this phase is written as though the mirror is intended. **Confirm or kill it before starting.** If messaging is REST-only, delete the Firestore half of this phase and it becomes a routine feature — cut it to a polling interval and move on.

## What this covers, and why it's here

Conversations and messages end to end: the Postgres model, the REST endpoints, and — if confirmed — a Firestore projection that clients subscribe to for live delivery, plus the frontend thread UI.

It comes fourth, before the broad feature phases, because a dual-write architecture is a **structural** decision. If Postgres and Firestore both hold messages, every subsequent messaging feature inherits whatever consistency model is chosen here. Retrofitting a mirror onto a mature messaging feature means backfilling, reconciling and rewriting the read path. Deciding now costs a phase; deciding at the end costs a rewrite.

## The architecture to prove

Postgres stays **authoritative**. Firestore is a **read-only projection** clients subscribe to for latency. Clients never write to Firestore directly — a message send is always `POST /conversations/{id}/messages`, and the mirror follows.

This ordering matters. If clients wrote to Firestore directly you would need the moderation rules, ban checks and participant authorization duplicated in Firestore security rules, and they would drift from the backend's. Keeping writes on the REST path means authorization lives in exactly one place.

The failure mode to design against is not "Firestore is down" — it is **silent drift**, where the mirror is subtly wrong and nobody notices because the UI reads the mirror.

## Tasks

**Backend, Postgres — done**
- [x] `conversations` and `messages` migrations, per §3 (`V10__messaging.sql`). `listing_id` nullable — a conversation outlives its listing.
- [x] Uniqueness: one conversation per (listing, participant pair) — a partial unique index; a null-listing pair also has its own uniqueness path (`findByParticipantPairWithoutListing`)
- [x] `GET /conversations`, `POST /conversations`, `GET /conversations/{id}/messages`, `POST /conversations/{id}/messages`, `PATCH /conversations/{id}/read`, plus `GET /conversations/{id}` (added 2026-09-02 for the frontend thread header — not in the original list, but the frontend needed a way to fetch one conversation's participant/listing context without paginating the whole inbox)
- [x] Participant authorization on every route — `ConversationService#findVisibleConversation`, covered by `MessagingApiTest`
- [x] Cursor pagination on message history
- [x] Conversations about `SUSPENDED` or `EXPIRED` listings stay accessible — **this line was stale; corrected 2026-09-09.** The conversation row itself is still unaffected by listing status (no FK cascade, no status check in `ConversationService`, correctly), but a status check does exist one layer up: `ListingSearchService#getPublicOrOwnerListingDetail` 404s `GET /listings/{id}` for anyone but the owner/admin whenever the listing isn't `PUBLISHED` + `AVAILABLE` — suspended and expired both included, not just soft-deleted. The frontend catches exactly that 404 and renders a real degraded state (see below), it does not silently hide the card.

**Firestore mirror — only if confirmed**
- [ ] Decide the trigger: transactional outbox, or post-commit hook. An outbox survives a crash between commit and publish; a hook does not.
- [ ] Firestore document shape and collection layout
- [ ] Security rules: participants read their own threads, **no client writes at all**
- [ ] Reconciliation job that detects and repairs drift, plus a metric that makes drift visible
- [ ] Deliberate failure test: kill the mirror mid-send, confirm Postgres is correct and the mirror self-heals
- [ ] Client read path: subscribe to Firestore, fall back to REST polling when unavailable

**Frontend — done 2026-09-02, with real gaps noted below**
- [x] Thread list (`/messages`) and conversation view (`/messages/[id]`) — real data, not ported from `ui_kits/mobile_app/MessagesScreen.jsx` (built from the pre-existing mock's own layout instead, same as favorites)
- [x] Listing context card inside the thread — **stale line, corrected 2026-09-09.** It does render the specified degraded state: icon, "Annonce indisponible", and an explanation, for exactly the case the backend note above covers. Verified live (real Chrome session via `chrome-devtools` MCP, signed in as a real account) by suspending a real listing mid-conversation and confirming the card. Two real, separate bugs were found and fixed the same session while doing that verification, unrelated to the card's content: it was scrolling away with the messages instead of staying visible, and — the more serious one — the message composer was never actually pinned to the bottom of the screen either, so a long thread scrolled the reply box out of reach entirely. Root cause for both: the thread's outer `<main>` used `minHeight: '100vh'` instead of a bounded `height`, so the *document* ended up scrolling instead of the internal message region the layout was designed around. Fixed by bounding it properly; see `TODO.md`'s messaging section for the full writeup, including a third fix (the site's global footer, previously unconditional on every route, now hides itself specifically on this one via a new `components/SiteFooter.tsx`).
- [~] Composer — done, but **not optimistic**: it waits for `POST .../messages` to succeed before the sent message appears, rather than showing it immediately and reconciling. Simpler and safer, but not what this task asked for.
- [ ] **Unread badges — deliberately not built.** `ConversationResponse` carries no unread count, and computing one for an inbox list would mean fetching every conversation's messages just to render a badge. Not done because inventing a fake number would be worse than no badge; a real fix needs a backend aggregate (e.g. an `unreadCount` field on the conversation list response).
- [ ] **Read receipts — not built.** `PATCH /conversations/{id}/read` is called on thread open (so `readAt` gets set server-side), but nothing in the UI surfaces "seen" back to the sender.
- [~] Contact dialog from the listing page — the "Contacter" button on `/listings/[id]` now actually works (previously had no `onClick` at all): it calls `POST /conversations` and navigates straight to the new thread. This is a different UX shape than the specified dialog-then-toast — no modal, no toast, just a direct navigation. Cheaper to build and arguably more useful, but it's a deviation from the mockup, not an oversight.

## Depends on

- Phases 01–03
- Design doc §3 `conversations`/`messages`, §4 conversations tied to inactive listings, §7 Messaging
- Mockups: `ui_kits/mobile_app/MessagesScreen.jsx` (thread list, conversation, composer), contact dialog in `ui_kits/website/index.html`

## Done looks like

- Two users hold a conversation about a listing, from both browsers
- A non-participant gets a clean 403 on every messaging route
- Suspending the listing leaves the thread readable and visibly marks the listing unavailable
- **If mirroring:** a message appears in the other browser without a refresh; killing the mirror mid-send leaves Postgres correct and the mirror converges; drift is detectable by a metric rather than by a user complaint
- **A written decision on Firestore**, either way, recorded in this file

## Risks and open decisions

- **The whole Firestore question is unconfirmed.** Everything above is contingent.
- **Dual-write consistency is the real risk**, not availability. Postgres-authoritative plus an outbox is the conservative answer; a post-commit hook is simpler and loses messages on an unlucky crash.
- **Firestore is a second datastore with its own billing, SDK, security-rules language and failure modes** — for a solo developer that is a permanent operational cost. Polling every few seconds is unglamorous and might genuinely be enough at MVP scale. Worth pricing honestly against the latency gain before committing.
- **Moderation of message content is not in the design doc at all.** Reports target `LISTING` or `USER`, never a message or a conversation. On an anti-scam platform where the scam happens in the chat, that is a gap worth naming now even if it stays out of MVP.
- **Banned users' messages are soft-deleted** (§6). Confirm the mirror honours that — a soft-delete that only applies to Postgres would leave the content live in Firestore, which is exactly the kind of drift that matters.
