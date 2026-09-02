# 00 — Project overview

*Confirm this document is right before we start on phase 01. Everything downstream assumes it.*

## Source documents this is built from

| What you asked for | What I actually read |
| --- | --- |
| `docs/design-doc.md` | `docs/colocation-platform-design.md` — the only design doc present |
| `design-reference/` | `design-system/` (tokens, 16 components, guidelines, 2 UI kits) and `flows/listing-creation/` (the 8-step wizard) |

Neither of your paths exists under those names; both map unambiguously onto what is on disk. See `docs/ANALYSIS.md` for how the design material got into its current shape.

---

## The product

**Dari** is a colocation / room-rental platform for Morocco, launching in Rabat, Casablanca, Marrakech and Tanger. It replaces scattered Facebook groups and WhatsApp listings with structured, filterable listings, in-platform messaging, user verification, and an active moderation system.

The moderation system is not a bolt-on — **fighting scams and unauthorized brokers ("smsar") is the core value proposition.** A listing does not go live without admin approval. That single fact shapes the whole build sequence: nothing is publicly visible until the moderation path works.

Two roles share one platform:
- **Offerers** list a room with structured pricing, amenities, house rules and photos.
- **Seekers** search and filter by location, price, amenities and living preferences.

MVP only. Roommate compatibility matching, monetisation, a recommendation engine, map clustering, WhatsApp OTP, a separate moderator tier, and reporter-reliability weighting are all explicitly out.

## Tech stack

| Layer | Choice |
| --- | --- |
| Backend | Spring Boot monolith |
| Database | PostgreSQL + PostGIS (`geography(Point)` + GiST index) |
| Auth | Firebase Authentication — client-side signup/login, backend verifies ID tokens via Firebase Admin SDK |
| Web | React |
| Mobile | React Native, after the web API stabilises |
| Storage | Local disk or MinIO (S3-compatible), swappable |
| Maps | Leaflet / MapLibre |

**There are no login or signup endpoints.** The client talks to Firebase directly and sends `Authorization: Bearer <token>` on every backend call. `POST /users` creates the internal profile row once, after first Firebase signup. The backend never sees a password.

## The three things that decide whether this works

Everything else in this system is competent CRUD. These three are where the project can actually go wrong, and all three are validated in phases 02 and 04, before broad feature-building:

**1. PostGIS geospatial search.** Radius search and distance sort over a `geography(Point)` column with a GiST index, combined with cursor-based pagination and a dozen other filters. The risk is not "does PostGIS work" — it is whether radius filtering, distance sorting and cursor pagination compose correctly in one query without a full table scan. Cursor pagination on `created_at`/`id` and sorting by distance are in tension; that tension needs resolving early.

**2. The two-dimensional listing lifecycle.** `status` (DRAFT / PENDING_REVIEW / PUBLISHED / REJECTED / SUSPENDED / EXPIRED) and `availability_state` (AVAILABLE / ROOM_FOUND / CLOSED) are deliberately independent. The search invariant — `status = PUBLISHED AND availability_state = AVAILABLE` — is the single most important filter in the product, and a leak in it means unapproved or scam listings become publicly visible. This needs a transition guard and an exhaustive test matrix, not ad-hoc `if` statements sprinkled through services.

**3. Messaging — and an unresolved architecture question.** See below.

## Open question: Firestore message mirroring

You named "Firestore message mirroring" as a risk to validate early. **The design doc does not mention it.** There is no reference to Firestore, realtime, websockets, push, or mirroring anywhere in it — §7 defines messaging as five plain REST endpoints and §8 draws Firebase as an identity provider only, with Postgres as the sole datastore.

So one of two things is true, and I need you to tell me which:

- **(a) The design doc is behind your thinking**, and you do intend a Firestore mirror for realtime message delivery. Phase 04 is written for this case: Postgres stays authoritative, Firestore is a read-only projection clients subscribe to, and the phase exists specifically to prove the mirror can't drift.
- **(b) Messaging is REST-only** as written, and realtime is a later concern. Phase 04 shrinks to roughly half its size and the dual-write risk disappears entirely.

I've planned for **(a)** because that is what you asked to de-risk, and because it is the strictly larger piece of work — cutting it later is easy, adding it later is not. But it is the biggest unconfirmed assumption in this plan.

## What the design system already gives us

Complete and ready to build against: color, type, spacing, radius, elevation and motion tokens; 16 components across core / forms / navigation / feedback / listings; 17 guideline specimen cards; and detailed copy rules (French, *vous*, sentence case, no emoji, no exclamation marks, `3 200 MAD/mois` with a thin space, ratings with a decimal comma).

Mockups that exist:

| Surface | Where |
| --- | --- |
| Mobile: feed, filters sheet, listing detail, messages, profile, favorites empty state | `design-system/ui_kits/mobile_app/` |
| Web: homepage, search results with sticky filter rail, contact dialog | `design-system/ui_kits/website/` |
| The 8-step listing creation wizard, desktop + mobile | `flows/listing-creation/` |

**Mockups that do not exist** — we will be designing these as we go, and each phase that needs one says so:

- Auth screens (signup, login, email verification)
- The entire admin / moderation console
- The report-a-listing flow
- The owner's "my listings" dashboard, with status and rejection reasons
- Map view
- Notifications

Two known asset gaps carried over from the design sessions: **the client logo and all photography are missing binaries** (`design-system/assets/README.md`), so every image slot renders the `sable-200` PHOTO placeholder. This does not block any backend work and does not block frontend structure, but it does block anything that looks finished.

## Scope boundary

MVP is **web + backend**. React Native comes after the API stabilises, as phase 10 — the design doc is explicit that we build web first and wrap the stabilised API afterwards. Do not let mobile pull work forward.

## A naming inconsistency to settle

The design doc says "Tangier"; the wizard and design system say "Tanger". The product's interface language is French, so **Tanger** is almost certainly right for anything user-facing, with the English form reserved for internal documentation. Worth fixing the city enum once, now, rather than in three places later.
