# 05 — Listing creation: the full write model + the wizard

## What this covers, and why it's here

The complete listing write path — `listing_rooms`, `amenities`, `listing_amenities`, `house_rules`, `listing_photos`, file storage — and the 8-step creation wizard on the frontend.

It comes after the risk spikes because it is **breadth, not risk**. It is a large phase, but every part of it is well-specified and none of it is architecturally uncertain. Phase 02 deliberately built a stub `listings` table; this is where that stub becomes the real thing.

It comes before moderation because moderation needs something to moderate. After this phase, listings can reach `PENDING_REVIEW` — and then stop, because nothing can approve them yet. That is the correct seam: phase 06 opens the gate.

This phase has an unusual advantage: **the wizard already exists as a working prototype**, at desktop and mobile widths, with real state logic. `flows/listing-creation/Listing Wizard.dc.html` is a specification, not a sketch — it defines all 8 steps, the field-level behavior and the responsive transformations. Read it before writing the API, because it encodes product decisions the design doc does not.

## Tasks

**Backend**
- [x] Migrations: `listing_rooms`, `amenities`, `listing_amenities`, `house_rules`, `listing_photos` (`V8`, `V11`, `V12`)
- [x] Seed the `amenities` lookup — the wizard's 10 are the starting set (`V12`, read via `AmenityRepository` since 2026-09-02)
- [x] Expand `listings` to the full §3 column set (`V8`)
- [x] `POST /listings` creating a `DRAFT`; `PATCH /listings/{id}`; `DELETE /listings/{id}` as soft-delete
- [x] `GET /listings/{id}` — keeps the thin `PublicListingResponse` contract for search consumers and now returns a dedicated `PublicListingDetailResponse` with real listing attributes, charge inclusions, availability, amenities, and stored photos. House rules remain intentionally absent until a read contract is built.
- [x] Ownership checks on every mutation
- [x] Photo upload: `GET/POST/PATCH/DELETE /listings/{id}/photos`, with `sort_order` and `is_cover`; the public detail response reads the ordered active photos back for display. The owner-scoped `GET` was added 2026-09-02 — only write routes existed before, so a resumed draft could never show the photos the server already held.
- [x] Storage abstraction behind an interface (`ImageStore`/`LocalImageStore`) — local disk now, swappable later without touching callers
- [x] Image validation: type (`jpeg`/`png`/`webp`), size (5 MB max), dimensions (200px min). EXIF is stripped for real — every upload is decoded and re-encoded into a fresh `BufferedImage`, which drops all metadata, not just GPS.
- [x] `POST /listings/{id}/submit` enforces a non-blank description and at least one active photo before the legal `DRAFT`/`REJECTED` -> `PENDING_REVIEW` transition, with French `VALIDATION_FAILED` responses.
- [x] **Editing a `PUBLISHED` listing does not return it to review** (§4) — `ListingService.applyUpdate` never touches `status`, so this holds. Worth keeping the explicit test if one gets added.
- [ ] Validation matching the wizard: neighborhood must belong to the chosen city, coordinates required (lat/long `@NotNull` exists), `min_stay_months` and `available_from` sane — `min_stay_months` now enforces the database's 1–36 month range, `available_from` cannot be in the past on create and patch, bedroom and bathroom counts enforce the database's nullable 0–20 ranges, roommate counts enforce the database's current 0–20 and maximum 1–20 ranges, current roommates cannot exceed the maximum (including merged partial patches), and rent/deposit enforce the database's `NUMERIC(10,2)` precision. Create and patch reject blank required title, city, and neighborhood values while preserving omitted PATCH fields. Invalid `property_type` and `room_type` JSON values now return the API's French `VALIDATION_FAILED` response instead of a 500; draft enum fields remain nullable and submission still requires both. Photo PATCH sort order is now validated as non-negative through the validated request DTO, and malformed typed photo PATCH query parameters return field-level validation errors instead of 500s. Neighborhood/city membership remains unbuilt because no neighborhood reference data exists yet.
- [x] Lifecycle actions ignore soft-deleted listings: submit, mark-room-found, and reopen now use the same active-owner lookup as other listing mutations.

**Frontend**
- [ ] Port the wizard from prototype to production React, all 8 steps — **the live wizard has 4 condensed steps** (`Annonce`, `Chambre`, `Photos`, `Validation`), not the prototype's 8. It has never been checked against `flows/listing-creation/Listing Wizard.dc.html` for parity.
- [x] Draft persistence — the wizard loads the owner's latest active draft from `GET /listings/draft`, creates it on the first step transition, and updates it with `PATCH /listings/{id}` before later transitions and final submission. Final publication still uses the existing `POST /listings/{id}/submit` lifecycle action.
- [ ] Map pin drop with Leaflet/MapLibre, centred on the chosen city; **coordinates are never typed** (§3) — the live wizard still has raw lat/long text inputs (confirmed by reading the "Annonce" step's fields); no map picker exists yet.
- [ ] Repeatable room list, with the salon-as-bedroom case working — not built; the wizard has singular `numBedrooms`/`numBathrooms` fields, no per-room list.
- [x] Photo upload with reorder and cover selection; first photo is the cover — built 2026-09-02. The wizard's "Photos" step was previously a dead button: no file input existed anywhere in the web app, so no listing could satisfy the submit precondition and publishing was impossible end to end. It now uploads through `POST /listings/{id}/photos`, lists via the new `GET /listings/{id}/photos`, and supports cover selection and delete. **Reordering uses explicit move buttons, not drag-and-drop** — a deliberate choice, since hand-rolled drag works with neither a keyboard nor touch, and the resulting order is identical.
- [ ] Per-step validation and the mobile transformations the responsive sheet specifies — not built. Draft resumption is now server-side; map picker, 8-step parity, room lists, and neighborhood membership remain out of scope.
- [x] Amenities selection (2026-09-02) — the "Équipements" step now fetches real codes from `GET /amenities`, labels them via `AMENITY_LABELS`, and sends `amenityCodes` on create.
- [x] Public listing detail (2026-09-02) — `/listings/[id]` renders the rich API response and real photo gallery, and removes fabricated roommates, rules, owner rating, verification badges, and availability copy.
- [x] Property/room type selection (2026-09-02) — two real selects bound to the backend's actual `PropertyType`/`RoomType` enums, replacing a fictional single dropdown.
- [~] "My listings" dashboard (`/account/listings`, wired 2026-09-02) — status per listing (real `LISTING_STATUS_LABELS`), rejection reasons, submit/mark-room-found/reopen/delete. Draft editing is available through the publish wizard's resume flow; a separate dashboard "Modifier" link remains out of scope. Required `GET /listings/mine`, since nothing previously let an owner list every status of their own listings.

**Real bugs found and fixed in the create wizard while scoping edit mode (2026-09-02), not the edit mode itself:**
- **Silent data corruption, fixed**: the wizard's "Type" dropdown (options: Chambre / Studio / Coliving / Appartement partagé — none of which are real backend values) was never wired to any state. Every published listing was hardcoded to `roomType: 'PRIVATE', propertyType: 'APARTMENT'` regardless of what the owner picked. Replaced with two real selects — "Type de bien" (`PropertyType`: Appartement/Maison/Studio) and "Type de chambre" (`RoomType`: Chambre privée/Chambre partagée) — matching the backend's actual, independent two-axis model, both now sent in the request body.
- **Found and disclosed 2026-09-02, fixed 2026-09-02**: the "Équipements" step collected a `selectedAmenities` array that was never sent to the backend, because no endpoint anywhere wrote to `listing_amenities`. Now fixed — see "Amenities backend write support" below.

**Amenities backend write support (2026-09-02):**
- Added `Amenity` (read entity over the `amenities` reference table) and `ListingAmenity` (join-row entity, `@IdClass` on `(listing, amenityCode)`, mirroring the `Favorite` pattern) plus their repositories.
- `CreateListingRequest`/`UpdateListingRequest` gained an optional `Set<String> amenityCodes`. `ListingService.create`/`update` validate every code exists in the `amenities` table (400 `VALIDATION_FAILED` otherwise) and do a full replace (`update` with `amenityCodes` present deletes the listing's existing rows and inserts the new set — simplest correct semantics for a checkbox-list UI). Omitting the field entirely leaves existing amenities untouched; sending `[]` clears them.
- `ListingResponse` (used by `/listings`, `/listings/{id}` PATCH, `/listings/mine`, and the admin approve/reject endpoints) now carries `amenityCodes`. `PublicListingResponse` (the public search/detail DTO) was deliberately left untouched — this pass scoped the owner/write side only; exposing amenities on the public detail page is separate frontend work (see the new finding below).
- `GET /amenities` now reads from the `amenities` table via `AmenityRepository` instead of a hardcoded duplicate list, removing a maintenance hazard (the two lists could have drifted).
- Frontend: `lib/labels.ts` gained a shared `AMENITY_LABELS` map (previously duplicated inline in `listings/page.tsx`'s filter panel); the publish wizard now fetches `GET /amenities` for its option codes, labels them via `AMENITY_LABELS`, and sends `amenityCodes` in the `POST /listings` body — the fictional French-string amenity list is gone.
- Tested: `ListingApiTest.amenitiesRoundTripOnCreateAndUpdate` (create with codes round-trips through `/listings/mine`, update replaces the set, an unknown code is rejected with 400).

The public detail page now consumes the richer `PublicListingDetailResponse`, including the real description, amenities, listing attributes, availability, and ordered active photos. Fabricated description, amenities, roommate, rules, owner, verification, availability, and photo-counter content was removed. House rules and owner profile data remain intentionally absent because no read contract exists for them yet.

## Depends on

- Phases 01–03; phase 02's lifecycle machine especially
- Design doc §3 (all listing tables), §4 editing rules, §7 Listings
- **`flows/listing-creation/` — the wizard prototype, in full**, including the responsive sheet and the `HOODS`, `ROOM_TYPES` and `AMENITIES` constants
- Design system: `forms/`, `core/`, `listings/ListingCard`

## Done looks like

Verified true as of 2026-09-02 (checked by reading the code, not assumed):
- Editing a published listing leaves it published
- Uploaded photos carry no GPS EXIF (no metadata at all, in fact)
- Submitted listings sit in `PENDING_REVIEW` and are correctly invisible in search
- Amenities round-trip on create/update
- Owner create/PATCH requests cannot set moderation-owned rejection reasons
- Drafts can be created, patched, loaded through `GET /listings/draft`, and submitted without changing final-submit validation
- Listing search optimization tests now isolate `PUBLISHED`/`AVAILABLE`/non-deleted rows in the shared Testcontainers database; draft rows are intentionally preserved

**Verified false as of 2026-09-02** — do not assume these without re-checking:
- Full prototype parity and per-step validation are not complete
- Submitting without a photo or with a blank description is refused, with clear French validation messages
- Rooms and house rules round-trip — no UI or endpoint touches `listing_rooms` or `house_rules` at all
- The production wizard matches the prototype at 375px and 1440px — the live wizard has 4 steps, not the prototype's 8; never compared side by side

## Risks and open decisions

- **This is the largest phase in the plan.** If it needs splitting, the seam is backend write model first, wizard second — the wizard is useless without the API, and the API is testable without the wizard.
- **EXIF stripping is a real privacy hole**, not a nicety. A user's own photo can carry the exact address that fuzzing exists to hide.
- **Draft persistence is server-side:** the wizard creates a `DRAFT` on the first completed step transition and resumes the owner's latest active draft through `GET /listings/draft`.
- **Photo storage limits are unspecified** — max count, max size, whether server-side resizing happens at MVP. Cheap to set now.
- **The wizard's constants may not match the final taxonomy.** Its 10 amenities and per-city neighborhood lists are prototype values; confirm them as product data before they become a migration.
- **No mockup for the "my listings" dashboard**, and it is the screen owners live in after publishing. Built from primitives 2026-09-02 (see the task above) — still no real mockup to check it against, and editing is still missing.
