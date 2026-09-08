# 05 — Listing creation: the full write model + the wizard

## What this covers, and why it's here

The complete listing write path — `listing_rooms`, `amenities`, `listing_amenities`, `house_rules`, `listing_photos`, file storage — and the 8-step creation wizard on the frontend.

It comes after the risk spikes because it is **breadth, not risk**. It is a large phase, but every part of it is well-specified and none of it is architecturally uncertain. Phase 02 deliberately built a stub `listings` table; this is where that stub becomes the real thing.

It comes before moderation because moderation needs something to moderate. After this phase, listings can reach `PENDING_REVIEW` — and then stop, because nothing can approve them yet. That is the correct seam: phase 06 opens the gate.

This phase has an unusual advantage: **the wizard already exists as a working prototype**, at desktop and mobile widths, with real state logic. `flows/listing-creation/Listing Wizard.dc.html` is a specification, not a sketch — it defines all 8 steps, the field-level behavior and the responsive transformations. Read it before writing the API, because it encodes product decisions the design doc does not.

## Tasks

**Backend**
- [x] Migrations: `amenities`, `listing_amenities`, `house_rules`, `listing_photos` (`V11`, `V12`); `listing_rooms` (`V21`, 2026-09-08). **This line previously claimed `listing_rooms` shipped in `V8` — it never did.** `V8` only widened the `listings` table itself (`ALTER TABLE`, no new tables); the rooms table did not exist in any migration until `V21`, which is why "rooms round-trip" stayed false for so long while this box was ticked.
- [x] Seed the `amenities` lookup — the wizard's 10 are the starting set (`V12`, read via `AmenityRepository` since 2026-09-02)
- [x] Expand `listings` to the full §3 column set (`V8`)
- [x] `POST /listings` creating a `DRAFT`; `PATCH /listings/{id}`; `DELETE /listings/{id}` as soft-delete
- [x] `GET /listings/{id}` — keeps the thin `PublicListingResponse` contract for search consumers and now returns a dedicated `PublicListingDetailResponse` with real listing attributes, charge inclusions, availability, amenities, stored photos, and (2026-09-05) house rules: `houseRules.smokingAllowed`/`petsAllowed`/`guestsAllowed`/`quietHoursStart`/`quietHoursEnd`/`otherRules`, each independently nullable per §5's "silence is not a promise" design, and `null` as a whole when the listing has no rules row.
- [x] House-rules write contract (2026-09-05) — `POST /listings` and `PATCH /listings/{id}` accept a `houseRules` object, upserting the single `house_rules` row. Omitting it leaves existing rules untouched; sending it replaces all six answers including nulls, the same full-replace rule `amenityCodes` uses and for the same reason (the wizard step submits every field, so a per-field merge would make "clear this answer" inexpressible). A quiet-hours window with only a start or only an end is refused with a 400. The wizard step that fills this landed 2026-09-06 — see the frontend list below.
- [x] Ownership checks on every mutation
- [x] Photo upload: `GET/POST/PATCH/DELETE /listings/{id}/photos`, with `sort_order` and `is_cover`; the public detail response reads the ordered active photos back for display. The owner-scoped `GET` was added 2026-09-02 — only write routes existed before, so a resumed draft could never show the photos the server already held.
- [x] Storage abstraction behind an interface (`ImageStore`/`LocalImageStore`) — local disk now, swappable later without touching callers
- [x] Image validation: type (`jpeg`/`png`/`webp`), size (5 MB max), dimensions (200px min). EXIF is stripped for real — every upload is decoded and re-encoded into a fresh `BufferedImage`, which drops all metadata, not just GPS.
- [x] `POST /listings/{id}/submit` enforces a non-blank description and at least one active photo before the legal `DRAFT`/`REJECTED` -> `PENDING_REVIEW` transition, with French `VALIDATION_FAILED` responses.
- [x] **Editing a `PUBLISHED` listing returns it to review** — rule reversed 2026-09-02 at the product
  owner's direction; `docs/colocation-platform-design.md` §4 updated to match rather than left
  contradicting the code. `ListingService.update` moves `PUBLISHED` to `PENDING_REVIEW` and leaves every
  other status alone — a `DRAFT` must not be swept into the queue, since the create wizard PATCHes on
  every step. Covered by `ListingApiTest.editingPublishedListingReturnsItToReview`, which asserts both
  halves.
- [x] Validation matching the wizard: neighborhood must belong to the chosen city, coordinates required (lat/long `@NotNull` exists), `min_stay_months` and `available_from` sane — `min_stay_months` now enforces the database's 1–36 month range, `available_from` cannot be in the past on create and patch, bedroom and bathroom counts enforce the database's nullable 0–20 ranges, roommate counts enforce the database's current 0–20 and maximum 1–20 ranges, current roommates cannot exceed the maximum (including merged partial patches), and rent/deposit enforce the database's `NUMERIC(10,2)` precision. Create and patch reject blank required title, city, and neighborhood values while preserving omitted PATCH fields. Invalid `property_type` and `room_type` JSON values now return the API's French `VALIDATION_FAILED` response instead of a 500; draft enum fields remain nullable and submission still requires both. Photo PATCH sort order is now validated as non-negative through the validated request DTO, and malformed typed photo PATCH query parameters return field-level validation errors instead of 500s. City membership is now enforced (2026-09-06): `ListingService.create`/`update` reject a `city` with no row in the `neighborhoods` table (`V20__neighborhoods.sql`, 4 launch cities) with a 400. The neighborhood *name* deliberately stays free text — the seed list is only 10 names per city, and rejecting a real one missing from it would lock out a real owner over a launch-week gap in the list, not a mistake; that's a different, harder product call than the city check and remains open.
- [x] Lifecycle actions ignore soft-deleted listings: submit, mark-room-found, and reopen now use the same active-owner lookup as other listing mutations.

**Frontend**
- [ ] Port the wizard from prototype to production React, all 8 steps — **the live wizard has 5 condensed steps** (`Annonce`, `Chambre`, `Règles`, `Photos`, `Validation`), not the prototype's 8. It has never been checked against `flows/listing-creation/Listing Wizard.dc.html` for full parity, though the Règles step (added 2026-09-06) does match the prototype's step 6 fields (smoking/pets/guests switches, quiet-hours range, free-text other rules).
- [x] Draft persistence — the wizard loads the owner's latest active draft from `GET /listings/draft`, creates it on the first step transition, and updates it with `PATCH /listings/{id}` before later transitions and final submission. Final publication still uses the existing `POST /listings/{id}/submit` lifecycle action.
- [x] Map pin drop, centred on the chosen city; **coordinates are never typed** (§3) — `LocationPicker.tsx` is wired into the "Annonce" step (not Leaflet/MapLibre as originally scoped, but the raw lat/long inputs are gone; a manual pair remains collapsed inside the picker for keyboard access).
- [ ] Repeatable room list, with the salon-as-bedroom case working — no UI yet; the wizard still has only singular `numBedrooms`/`numBathrooms` fields. The backend structure landed 2026-09-08 (`V21`, `ListingRoom`, `ListingRoomRepository`); read contract, write contract, and the "Pièces" step remain.
- [x] Photo upload with reorder and cover selection; first photo is the cover — built 2026-09-02. The wizard's "Photos" step was previously a dead button: no file input existed anywhere in the web app, so no listing could satisfy the submit precondition and publishing was impossible end to end. It now uploads through `POST /listings/{id}/photos`, lists via the new `GET /listings/{id}/photos`, and supports cover selection and delete. **Reordering uses explicit move buttons, not drag-and-drop** — a deliberate choice, since hand-rolled drag works with neither a keyboard nor touch, and the resulting order is identical.
- [x] House rules step (2026-09-06) — a new "Règles" step between "Chambre" and "Photos": three switches (fumeur/animaux/invités, always concrete true/false, never left null once visited), a quiet-hours "De"/"À" pair from a fixed 9-option hour list, and an optional free-text "Autres règles". Round-trips through `draftPayload`/`loadDraft` like every other field; verified against a real published listing.
- [ ] Per-step validation and the mobile transformations the responsive sheet specifies — not built. Draft resumption is now server-side; 8-step prototype parity and room lists remain out of scope. Map picker, house rules, and city-membership validation are now done.
- [x] Amenities selection (2026-09-02) — the "Équipements" step now fetches real codes from `GET /amenities`, labels them via `AMENITY_LABELS`, and sends `amenityCodes` on create.
- [x] Public listing detail (2026-09-02) — `/listings/[id]` renders the rich API response and real photo gallery, and removes fabricated roommates, rules, owner rating, verification badges, and availability copy.
- [x] Property/room type selection (2026-09-02) — two real selects bound to the backend's actual `PropertyType`/`RoomType` enums, replacing a fictional single dropdown.
- [x] "My listings" dashboard (`/account/listings`, wired 2026-09-02) — status per listing (real `LISTING_STATUS_LABELS`), rejection reasons, submit/mark-room-found/reopen/delete, and **a "Modifier" link that opens the wizard on that listing** (added 2026-09-02). Required `GET /listings/mine` and, for edit, `GET /listings/mine/{id}`.

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

The public detail page now consumes the richer `PublicListingDetailResponse`, including the real description, amenities, listing attributes, availability, ordered active photos, and (2026-09-06) a "Règles de la maison" section rendering `houseRules` when at least one field is set. Fabricated description, amenities, roommate, rules, owner, verification, availability, and photo-counter content was removed. Owner profile data remains intentionally absent because no read contract exists for it yet.

## Depends on

- Phases 01–03; phase 02's lifecycle machine especially
- Design doc §3 (all listing tables), §4 editing rules, §7 Listings
- **`flows/listing-creation/` — the wizard prototype, in full**, including the responsive sheet and the `HOODS`, `ROOM_TYPES` and `AMENITIES` constants
- Design system: `forms/`, `core/`, `listings/ListingCard`

## Done looks like

Verified true as of 2026-09-06 (source and full test suite checked):
- Editing a published listing returns it to `PENDING_REVIEW`; drafts remain drafts while the wizard autosaves
- Uploaded photos carry no GPS EXIF (no metadata at all, in fact)
- Submitted listings sit in `PENDING_REVIEW` and are correctly invisible in search
- Amenities round-trip on create/update
- House rules round-trip end to end: entity/repository, read contract (`GET /listings/{id}`, `houseRules` on the owner-facing `ListingResponse`), write contract (create/patch, full-replace, quiet-hours cross-field check), the detail page's "Règles de la maison" section, and the wizard's "Règles" step — all verified against a real published listing, not just the test suite
- A listing's city is rejected on create/patch unless it has at least one row in the `neighborhoods` reference table (the four launch cities); neighborhood name itself is still free text
- Owner create/PATCH requests cannot set moderation-owned rejection reasons
- Drafts can be created, patched, loaded through `GET /listings/draft`, and submitted without changing final-submit validation
- Listing search optimization tests now isolate `PUBLISHED`/`AVAILABLE`/non-deleted rows in the shared Testcontainers database; draft rows are intentionally preserved

**Verified false as of 2026-09-06** — do not assume these without re-checking:
- Full 8-step prototype parity and full per-step validation are not complete
- Submitting without a photo or with a blank description is refused, with clear French validation messages
- Rooms round-trip — the `listing_rooms` table and its entity/repository now exist (`V21`, 2026-09-08), but no service, endpoint, or UI touches them yet, so nothing round-trips.
- The production wizard matches the prototype at 375px and 1440px — the live wizard has 5 steps, not the prototype's 8; never compared side by side

## Risks and open decisions

- **This is the largest phase in the plan.** The backend write model is substantially complete; house rules, map selection, and city-membership validation are now done end to end. What remains is full 8-step prototype parity and room data (`listing_rooms`).
- **EXIF stripping is a real privacy hole**, not a nicety. A user's own photo can carry the exact address that fuzzing exists to hide.
- **Draft persistence is server-side:** the wizard creates a `DRAFT` on the first completed step transition and resumes the owner's latest active draft through `GET /listings/draft`.
- **Photo storage limits are unspecified** — max count, max size, whether server-side resizing happens at MVP. Cheap to set now.
- **The wizard's constants may not match the final taxonomy.** Its 10 amenities and per-city neighborhood lists are prototype values; confirm them as product data before they become a migration.
- **No mockup for the "my listings" dashboard**, and it is the screen owners live in after publishing. Built from primitives 2026-09-02 (see the task above) — still no real mockup to check it against, and editing is still missing.
