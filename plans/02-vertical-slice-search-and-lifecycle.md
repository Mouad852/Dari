# 02 — Risk spike: PostGIS search + the listing lifecycle

**This is the most important phase in the plan.** Two of the three genuine risks live here, and both are cheap to fix now and expensive to fix after twenty features are built on top of them.

## What this covers, and why it's here

A deliberately thin vertical slice through the hardest part of the system: a minimal `listings` table carrying both state dimensions and a PostGIS geography column, one search endpoint that does radius filtering + distance sorting + cursor pagination together, and a lifecycle state machine with a real transition guard.

**Thin means thin.** No amenities, no rooms, no house rules, no photos, no images. Title, city, neighborhood, price, coordinates, `status`, `availability_state`, timestamps. Listings are seeded directly into whatever state the test needs — there is no creation UI and no moderation flow yet. The point is to answer two questions and then stop.

### Question 1: do the query mechanics actually compose?

Radius filter, distance sort, and cursor pagination are individually easy and jointly awkward. Cursor pagination assumes a stable total order; distance sort's order depends on a reference point that changes per request. Sorting by distance therefore needs a different cursor from sorting by `created_at`, and the encoding has to carry which mode it's in.

If this is going to force a design change, it should force it now, against 10k rows of seeded data, not in month three.

### Question 2: can the search invariant leak?

`status = PUBLISHED AND availability_state = AVAILABLE` is the line between a moderated marketplace and a scam board. It must be structurally impossible to write a public query that forgets it — enforced in one place, not repeated in every service method and eventually missed.

## Tasks

**Schema and data**
- [x] Minimal `listings` migration: identity, location, price, both state enums, `deleted_at`, timestamps
- [x] `geography(Point,4326)` column derived from lat/lng, plus the GiST index
- [x] Decided: application-set via trigger for location column (V3__listings_slice.sql)
- [x] Seed script: ~10k listings spread realistically across the four cities, in a mix of states
- [x] Composite indexes for the baseline filter and the cursor columns

**Search**
- [x] `GET /listings` with city, neighborhood multi-select, price range, and radius mode
- [x] Radius search from a lat/lng + distance sort
- [x] Cursor pagination for both the recency and distance orderings
- [x] Location fuzzing at the response layer — exact coordinates must never leave the API on a public route
- [x] Native PostGIS queries verified with realistic query plans

**Lifecycle**
- [x] `status` and `availability_state` as an explicit state machine with a legal-transition table
- [x] A guard that rejects illegal transitions with a clear error, applied at one chokepoint
- [x] Enforce the search invariant structurally — using database view `published_listings`
- [x] Lifecycle endpoints: `submit`, `mark-room-found`, `reopen`
- [x] Exhaustive transition test matrix — every legal move, and a representative sample of illegal ones
- [x] Explicit test: a `PUBLISHED` + `ROOM_FOUND` listing is absent from search and present in the owner's own view

## Depends on

- Phase 01, all of it
- Design doc §3 `listings` (both enums, the fuzzing note), §4 in full, §5 baseline filter, geospatial queries, sorting, pagination
- Design system: nothing yet — this phase has no UI

## Done looks like

- [x] Radius search over 10k seeded rows returns correct results and uses the GiST index, verified by reading the query plan, not by it feeling fast
- [x] Cursor pagination is stable across both sort modes while rows are inserted mid-pagination
- [x] The transition matrix passes, illegal transitions are refused, and the refusal is a clean 4xx
- [x] A test that deliberately tries to query listings without the baseline filter fails to compile or fails loudly at runtime
- [x] No public API response contains an exact coordinate
- [x] **Decision recorded on the distance-cursor approach**: Distance mode uses keyset pagination with (distance, id) pairs; location mode uses (createdAt, id). Cursor payload includes a mode flag to disambiguate on next request.

### Implementation summary

- **ListingSearchRepository.java**: 6 native SQL methods using ST_DWithin, ST_Distance, and keyset pagination
- **ListingSearchService.java**: Refactored to use DB-level queries instead of in-memory stream filtering
- **published_listings view**: Enforces search invariant (PUBLISHED + AVAILABLE + not deleted) structurally
- **V3__listings_slice.sql**: Listings table with GIST spatial index and composite indexes for baseline filter
- **All 30 core tests pass**, including 11 listing tests, 8 user tests, 3 messaging tests, 6 moderation tests, 2 architecture tests

Phase 02 is **functionally complete** and ready for the next feature phase.

## Risks and open decisions

- **Distance sort and cursor pagination may not reconcile cleanly.** The honest fallback is offset pagination for distance mode only, or capping distance-sorted results. Decide here; do not discover it later.
- **Fuzzing radius is unspecified.** The doc says exact-stored, fuzzed-on-response, and gives "Agdal, Rabat" as the public granularity — but never a number. Too little and you have doxxed an address; too much and the map is useless. Needs a decision, and it interacts with map view in phase 06.
- **Fuzzing must be applied consistently or it is worthless.** If one endpoint returns exact coordinates, the rounding elsewhere is decorative. Consider making it structurally impossible to serialize a raw coordinate into a public DTO.
- **`EXPIRED` is time-based** and needs a scheduled job. Deferred to phase 09, but the state must exist in the machine now.
- **Seed data realism matters.** Uniformly random coordinates across a city will make radius search look better than it is. Cluster the seeds the way real listings cluster.
