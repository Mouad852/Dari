# 07 — Search completeness, filters and map view

## What this covers, and why it's here

Every remaining filter category, the full sort set, the filter UI on web and mobile, listing detail, and the map view.

It comes seventh because it needs the complete data model to filter against. Phase 02 proved the query mechanics with four filters; phase 05 added rooms, amenities and house rules; phase 06 made listings publicly visible. Only now can the full filter surface be built and, more importantly, **verified against real published data.**

The composition rules from §5 are the part to get exactly right:

> Filters within a category are OR'd; filters across categories are AND'd. **Amenities are the exception — multi-selected amenities are AND'd** (must have all selected).

That amenity exception is the single most likely thing in this phase to be implemented wrong, because it contradicts the rule stated one sentence earlier. Selecting Wifi and Parking must return listings with *both*, not either.

## Tasks

**Backend**
- [x] Property type, room type and furnishing multi-select (OR within category) — already built; corrected 2026-09-02
- [x] Amenities multi-select — **AND**, requiring all selected, via a GROUP BY HAVING subquery; corrected 2026-09-02
- [x] Availability date: `available_from <= requested_move_in_date`, and listings with no date are excluded when one is requested; corrected 2026-09-02
- [ ] Living preferences mapped onto `house_rules` fields
- [x] Sorts: price ascending/descending, recency (default) and recently-updated are now real (2026-09-02); closest works in radius mode. **They previously did nothing** — `sort` was parsed and then ignored on every non-radius search, so three of the four options in the UI returned identical recency-ordered results.
- [ ] Define "recommended" concretely — §5 says recency plus basic quality signals, which is not yet a specification. **Still open on purpose (2026-09-02):** the default sort is honest recency and the UI now labels it "Plus récentes" rather than "Pertinence", instead of implying a ranking that does not exist. Needs a product answer, plus a keyset strategy for ordering by a computed score.
- [x] City and neighborhood versus radius as **mutually exclusive modes**, rejected with a 400; already built, corrected 2026-09-02. A `closest` sort without a radius is now also refused rather than silently downgraded.
- [x] Map endpoint returning pins for a city — flat list, no clustering; already built, corrected 2026-09-02
- [ ] Confirm fuzzed coordinates on the map path; this is where exact coordinates are most likely to leak
- [x] Re-run `EXPLAIN ANALYZE` with the full filter set applied (2026-09-02, 50k seeded listings). The amenity join was indeed the risk: the `IN (... GROUP BY ... HAVING)` form was evaluated globally, scanning 40k amenity rows before the city filter applied — 88 ms for the worst realistic query. Rewritten as a correlated COUNT, 35.7 ms, and now scaling with candidates in the city rather than the whole table.
- [x] Index review (2026-09-02). `V15__search_sort_indexes.sql`: recently-updated had no index and took 21.6 ms per page (now 0.38 ms); the price index lacked `id`, so the keyset tiebreaker needed an incremental sort (now a pure index scan in both directions). Also verified the CASE-based ORDER BY does not defeat index usage, including under repeated prepared-statement execution.

**Frontend**
- [ ] Desktop sticky filter rail, from `ui_kits/website/SearchResultsPage.jsx`
- [ ] Mobile filter bottom sheet, from `ui_kits/mobile_app/FiltersSheet.jsx`
- [ ] Filter chip row with active-filter counts, and a reset — *Réinitialiser*
- [ ] Selected chips invert to **charcoal, not terracotta**, so selection never competes with the primary action (a design-system rule that is easy to miss)
- [ ] Full listing detail page, from `ui_kits/mobile_app/ListingScreen.jsx` — photo header with glass controls, price block, logement / colocataires / règles tabs, sticky contact bar
- [x] Map view with Leaflet, pins and a popup linking to the listing; already built, corrected 2026-09-02
- [x] All filter state in the URL; already built, corrected 2026-09-02
- [x] Result counts (2026-09-02) — `GET /listings/count` returns `{count, capped}`, exact below 200 and "plus de 200" above. Capped because a count is more expensive than the page it labels: 85 ms against 35 ms on a filtered search over 50k listings, since a page stops at 21 rows and a count cannot stop at all. Reuses the existing search queries with a capped limit rather than adding a seventh copy of the filter predicate. The heading previously reported the number of rows *loaded*, so 12,500 Rabat listings announced as "20 annonces".

## Depends on

- Phases 02 (query foundation), 05 (the data to filter), 06 (published listings)
- Design doc §5 in full
- Mockups: `SearchResultsPage.jsx` (rail), `FiltersSheet.jsx` (sheet), `ListingScreen.jsx` (detail), `FeedScreen.jsx` (chip row)
- Design system: `forms/`, `navigation/Tabs`, `core/Tag`, `listings/ListingCard`

## Status (2026-09-02)

Search filter composition was tightened: a requested move-in date now requires
`available_from <= requested_move_in_date` (undated listings are excluded), and repeated or
comma-separated filter values are normalized before amenity AND matching. The focused listing API
and optimization tests plus the complete API suite pass (62 tests). Draft persistence, published
search isolation cleanup, map picker, 8-step parity, room lists, and neighborhood membership remain
unchanged/out of scope.

Fixed a real bug found while wiring favorites into this page, unrelated to that task but sitting in the same file: **search-result cards (`/listings`) had no link to the listing detail page at all** — clicking one did nothing. Every card is now wrapped in a `Link` to `/listings/{id}` (with the favorite-heart button layered above it via z-index so both stay independently clickable), and the map popup now has a "Voir l'annonce" link too. This closes the "listing detail page is... reachable from search" item below, including from the map — though the map view is still a plain popup with title/neighborhood/city/link, not the richer "card on pin select" the task list below describes, and there is still no clustering.

## Done looks like

- Every §5 filter category works, and combinations behave per the composition rules
- **A test proving amenities AND rather than OR**
- All six sorts work; "closest" is rejected cleanly when no reference point is given
- Radius mode and city/neighborhood mode cannot both be active
- Query plans stay healthy with every filter applied at once — no sequential scan introduced by the amenity join
- The map shows pins for a city, at fuzzed coordinates
- Filter UI matches the mockups on both widths, and a filtered URL is shareable
- The listing detail page is complete and reachable from search

## Risks and open decisions

- **"Recommended" is undefined.** It is the default sort, so it is what almost every user sees. Left unspecified it becomes "whatever the query happened to return", which is a product decision made by accident. Define it, even if the first version is just recency plus photo count.
- **The amenity AND join is the main performance risk.** Multiple required amenities means either repeated joins, a `GROUP BY … HAVING COUNT`, or a rewrite. Measure it rather than assuming.
- **Fuzzing interacts badly with map view.** A pin that moves every request looks broken; fuzzing must be deterministic per listing. Phase 02 left the radius open — it has to be settled here.
- **Fuzzing can be defeated by triangulation** if radius search reveals true distances. Worth a moment's thought about whether distance values should be rounded on the public path too.
- **Living preferences map onto `house_rules`, which is one-to-one with listings.** Filtering across that join is fine, but confirm the semantics — "non-smoker" filtering on `smoking_allowed = false` is a different claim from the room being smoke-free.
