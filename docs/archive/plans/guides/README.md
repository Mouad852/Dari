# Implementation guides

One guide per build phase. Each guide is the *how* for the phase doc one directory up, which stays the *what* and *why*.

Read the phase doc first, then the guide. The phase doc tells you what "done" means; the guide tells you how to get there.

## Index

| Guide | Phase | The hard part it solves |
| --- | --- | --- |
| [01-backend-foundation.md](01-backend-foundation.md) | [01](../01-backend-foundation.md) | Firebase filter, the missing-profile contract, Testcontainers on PostGIS |
| [02-vertical-slice-search-and-lifecycle.md](02-vertical-slice-search-and-lifecycle.md) | [02](../02-vertical-slice-search-and-lifecycle.md) | **Distance-cursor pagination, the generated geography column, structural invariant enforcement, fuzzing** |
| [03-frontend-foundation-and-search.md](03-frontend-foundation-and-search.md) | [03](../03-frontend-foundation-and-search.md) | Rendering strategy, porting the design system, the formatter, token refresh |
| [04-vertical-slice-messaging.md](04-vertical-slice-messaging.md) | [04](../04-vertical-slice-messaging.md) | **The transactional outbox, Firestore rules, drift detection** |
| [05-listing-creation.md](05-listing-creation.md) | [05](../05-listing-creation.md) | Two-tier validation, EXIF stripping, cover-photo invariants, the wizard |
| [06-moderation-and-admin.md](06-moderation-and-admin.md) | [06](../06-moderation-and-admin.md) | **The auto-flag window, the grouped queue, restoring `prior_status`, ban cascades** |
| [07-search-filters-and-map.md](07-search-filters-and-map.md) | [07](../07-search-filters-and-map.md) | **The amenity AND query**, defining `RECOMMENDED`, filter composition |
| [08-public-marketing-and-seo.md](08-public-marketing-and-seo.md) | [08](../08-public-marketing-and-seo.md) | Server rendering, sitemap correctness, keeping coordinates out of HTML |
| [09-profiles-favorites-account.md](09-profiles-favorites-account.md) | [09](../09-profiles-favorites-account.md) | Account deletion semantics, the public-profile leak surface |
| [10-jobs-hardening-and-launch.md](10-jobs-hardening-and-launch.md) | [10](../10-jobs-hardening-and-launch.md) | Idempotent expiry, rate limits, **the fuzzing audit** |
| [11-mobile-react-native.md](11-mobile-react-native.md) | [11](../11-mobile-react-native.md) | Token porting to RN, shadows, push, store submission |

There is no guide for `00-overview.md` — it is context, not a build phase.

## Decisions these guides make for you

The phase docs left several questions open. The guides answer them, with reasoning, so work can start. **Every one is overrulable** — but decide deliberately rather than by default.

| Decision | Guide | Answer |
| --- | --- | --- |
| UUID strategy | 01 | Application-side, v7 if available |
| Valid token, no profile row | 01 | 404; the client retries `POST /users`, the filter never auto-creates |
| Geography column | 02 | Generated column, not a trigger |
| Distance + cursor pagination | 02 | Keyset on `(distance, id)`, reference point carried in the cursor |
| Search invariant enforcement | 02 | A database view, plus an ArchUnit test |
| Fuzzing radius | 02 | 200 m, deterministic from the listing id |
| Rendering strategy | 03 | Next.js App Router — the SEO argument |
| Firestore mirroring | 04 | REST-only first; **build the outbox now** |
| Draft persistence | 05 | Server-side `DRAFT` rows from step 1 |
| Photo limits | 05 | 1–20 photos, 10 MB, resized to 2000px, all EXIF stripped |
| Restoring a dismissed auto-suspension | 06 | Read `prior_status`; never hard-code `PUBLISHED` |
| Amenity multi-select | 07 | `HAVING COUNT(DISTINCT)` in a subquery, keeping cursor logic intact |
| `RECOMMENDED` sort | 07 | Recency + photo count + description completeness, weights named |
| Account deletion | 09 | Firebase identity deleted, row and listings soft-deleted, messages retained |
| Verification tier | 09 | Derived from the booleans, never stored |
| Expiry window | 10 | 60 days, warned at 53, clock reset only by deliberate renewal |
| Expo vs bare RN | 11 | Expo with development builds |

## Cross-phase threads

Things introduced in one phase that later phases depend on. Breaking one of these breaks something far away:

- **The cursor encoder** (02) → messages (04), every sort (07)
- **`prior_status`** (02) → the dismiss-restore branch (06)
- **`LocationFuzzer` and the DTO chokepoint** (02) → map (07), rendered HTML (08), the audit (10)
- **The state machine** (02) → submit (05), approve/reject (06), expiry (10)
- **`format.ts`** (03) → every screen, and mobile (11)
- **The outbox** (04) → soft-delete on ban (06), notification delivery (10)
- **`PhotoStorage` + EXIF pipeline** (05) → avatars (09), mobile camera (11)
- **`NotificationService`** (06, stubbed) → implemented (10)
- **The rendering decision** (03) → all of phase 08

## A note on durability

Guides 01–07 describe work whose shape is settled by the design doc and will age well. Guides 08–11 describe work against systems that do not exist yet — versions, library APIs and platform requirements will have moved by the time you reach them. Re-check specifics there; trust the structure and the Dari-specific reasoning.
