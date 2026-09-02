# Guide — Phase 07: Search completeness, filters and map

Implementation guide for [`07-search-filters-and-map.md`](../07-search-filters-and-map.md).

Phase 02 proved the query mechanics with four filters. This adds the rest, plus the filter UI on both widths, listing detail, and the map.

---

## 0. The composition rule, stated precisely

§5, and the sentence that trips people up:

> Filters within a category are OR'd; filters across categories are AND'd. **Amenities are the exception — multi-selected amenities are AND'd.**

So `propertyType IN (APARTMENT, STUDIO)` means *either*, while amenities `[wifi, parking]` means listings having **both**. That contradiction lives one sentence after the general rule, which is exactly why it gets implemented wrong.

Write the test before the query:

```java
@Test void multipleAmenitiesAreAnded() {
    var both  = listingWith("wifi", "parking");
    var wifiOnly = listingWith("wifi");

    var results = search(amenities("wifi", "parking"));

    assertThat(ids(results)).contains(both.getId()).doesNotContain(wifiOnly.getId());
}
```

---

## 1. The amenity AND query

Relational division. Three approaches; the `HAVING COUNT` form is the right default:

```sql
SELECT l.*
FROM published_listings l
JOIN listing_amenities la ON la.listing_id = l.id
WHERE la.amenity_id = ANY(:amenityIds)
GROUP BY l.id
HAVING COUNT(DISTINCT la.amenity_id) = :amenityCount
```

Why this one: a single index scan on `idx_listing_amenities_amenity` (created in phase 05, deliberately `(amenity_id, listing_id)`), one pass, and the cost scales with the number of *matching* rows rather than the table.

The alternatives and why not:

- **Repeated `EXISTS` subqueries**, one per amenity — readable, and the planner usually handles it, but it degrades noticeably past three or four amenities and the SQL is built by string concatenation.
- **`INTERSECT` chains** — clean in theory, poor plans in practice.
- **Bitmask column** — fast, but the design doc explicitly rejected it (§3: normalized "so new amenities don't require migrations"), and it is right.

The complication: `GROUP BY l.id` interacts badly with the cursor keyset from phase 02, because the `HAVING` clause runs after grouping. Push the division into a subquery and keep the outer query's shape identical to phase 02:

```sql
SELECT l.*, CASE WHEN :refPoint IS NOT NULL
                 THEN ST_Distance(l.location, :refPoint) END AS distance_m
FROM published_listings l
WHERE (:amenityIds IS NULL OR l.id IN (
        SELECT la.listing_id FROM listing_amenities la
        WHERE la.amenity_id = ANY(:amenityIds)
        GROUP BY la.listing_id
        HAVING COUNT(DISTINCT la.amenity_id) = :amenityCount))
  AND (:city IS NULL OR l.city = :city)
  -- ... every other filter, unchanged from phase 02
  AND (:cursorRecentTs IS NULL OR (l.created_at, l.id) < (:cursorRecentTs, :cursorId))
ORDER BY /* as phase 02 */
LIMIT :limit + 1;
```

Now the amenity rule is one self-contained predicate and the pagination logic is untouched. **Re-run `EXPLAIN ANALYZE` after adding it** — this subquery is the main new risk to the plan.

---

## 2. The remaining filters

```java
public record ListingSearchRequest(
    // Location — mutually exclusive modes (§5)
    String city, List<String> neighborhoods,
    Double lat, Double lng, Integer radiusM,

    // Price
    BigDecimal priceMin, BigDecimal priceMax,

    // OR within category
    List<PropertyType>   propertyTypes,
    List<RoomType>       roomTypes,
    List<RoomFurnishing> furnishings,

    // AND — the exception
    List<String> amenityCodes,

    // Availability
    LocalDate availableBy,

    // Living preferences -> house_rules
    Boolean smokingAllowed, Boolean petsAllowed, Boolean guestsAllowed,

    SortMode sort, String cursor, Integer limit
) {}
```

Multi-select as SQL:

```sql
AND (:propertyTypes IS NULL OR l.property_type = ANY(:propertyTypes::property_type[]))
AND (:roomTypes     IS NULL OR l.room_type     = ANY(:roomTypes::room_type[]))
AND (:furnishings   IS NULL OR l.room_furnishing = ANY(:furnishings::room_furnishing[]))
AND (:availableBy   IS NULL OR l.available_from <= :availableBy)
```

The explicit enum-array casts are required; without them Postgres cannot resolve `= ANY` against an enum column.

### Living preferences — get the semantics right

`house_rules` is one-to-one with listings, so this is a left join. But **"non-smoker" filtering on `smoking_allowed = false` is a different claim from the room being smoke-free**, and the two are easy to conflate.

The columns are nullable — a listing whose owner never answered has `NULL`, which is neither true nor false. Decide explicitly:

```sql
-- Recommended: a seeker filtering for "non-fumeur" wants listings that SAY smoking
-- is not allowed. Unanswered is not a match — silence is not a promise.
AND (:smokingAllowed IS NULL OR hr.smoking_allowed = :smokingAllowed)
```

`NULL = false` evaluates to `NULL`, so unanswered listings drop out naturally. That is the correct behavior, but it is worth a comment because it looks like a bug.

---

## 3. Sorts

```java
public enum SortMode { RECOMMENDED, PRICE_ASC, PRICE_DESC, NEWEST, CLOSEST, RECENTLY_UPDATED }
```

**`RECOMMENDED` is the default, so it is what almost everyone sees, and §5 leaves it undefined.** Left unspecified it becomes "whatever the planner returned", which is a product decision made by accident. A defensible first version:

```sql
ORDER BY (
    EXTRACT(EPOCH FROM (now() - l.created_at)) / 86400.0 * -1.0     -- newer scores higher
    + LEAST(photo_count, 5) * 2.0                                    -- more photos, up to 5
    + CASE WHEN l.description IS NOT NULL
            AND length(l.description) > 100 THEN 3.0 ELSE 0 END      -- real description
) DESC, l.id DESC
```

Compute `photo_count` as a denormalised column updated on photo insert/delete rather than a correlated subquery — it is read on every search and written rarely.

Keep the weights in one named constant so they can be tuned without archaeology. And write down that this is a first pass; it is meant to be revisited with real data.

**`CLOSEST` requires a reference point.** Reject it cleanly rather than silently falling back:

```java
if (req.sort() == CLOSEST && req.lat() == null)
    throw new ApiException(400, ErrorCode.SORT_NEEDS_LOCATION,
            "Choisissez un point de référence pour trier par distance");
```

### If the multi-branch ORDER BY did not survive

Phase 02 flagged that the `CASE WHEN :sort = ...` construction can defeat index-driven sorting. With six sorts it is more likely to. If `EXPLAIN` shows a sort node over a large row count, **split into one query string per sort mode** — six near-identical queries assembled by a small builder. Repetitive, and correct, and fast. Do not contort the SQL to stay DRY.

---

## 4. Mutual exclusion

```java
boolean hasArea   = req.city() != null || isNotEmpty(req.neighborhoods());
boolean hasRadius = req.lat() != null && req.lng() != null && req.radiusM() != null;

if (hasArea && hasRadius)
    throw new ApiException(400, ErrorCode.CONFLICTING_FILTERS,
            "Choisissez une ville ou une recherche par rayon");

if (req.radiusM() != null && req.radiusM() > 50_000)
    throw new ApiException(400, ErrorCode.RADIUS_TOO_LARGE, "Rayon trop large");
```

Cap the radius. Unbounded, it is a full-table scan wearing a filter's clothing.

---

## 5. Map view

```
GET /api/v1/listings/map?city=Rabat&priceMax=4000
```

Flat list of pins for a city. **No clustering** — §5 defers it explicitly, and building it anyway is scope creep on the phase most likely to overrun.

```java
public record MapPin(UUID id, double lat, double lng, BigDecimal priceRent, String neighborhood) {}
```

Two rules that matter more here than anywhere else:

**Coordinates are fuzzed, through the phase 02 chokepoint.** The map is where a fuzzing leak is most visible and most damaging, because it renders the exact location directly on screen.

**Fuzzing must be deterministic**, which phase 02 guaranteed by seeding from the listing id. If pins move between requests the map looks broken, and repeated sampling would let someone average out the true location.

Cap the response — a few hundred pins maximum — and return a truthy `truncated` flag rather than silently dropping listings. Also round any distance you return to ~100 m, so radius queries cannot be used to triangulate past the fuzzing.

---

## 5.5 Current implementation snapshot (2026-08-31)

This phase is partly shipped on the web app and remains backend-driven.

- [x] `/listings` exposes a results/map toggle and keeps the active view in the URL
- [x] Map pins are fetched from `GET /api/v1/listings/map` and rendered with fuzzed coordinates only
- [x] Area mode and radius mode are mutually exclusive in the UI and URL payload
- [x] Search state is shareable across city, neighborhood, price, property, room, furnishing, and availability filters
- [x] Radius searches force a proximity order and hide incompatible sort choices
- [x] The frontend aligns with the real backend contract and avoids frontend-only mock flows for owner actions, favorites, or messaging
- [ ] Amenities multi-select and the `house_rules` preferences remain to be implemented end-to-end
- [ ] The result count CTA and the listing detail screen are still deferred until the backend API and UI contract are complete

---

## 6. Frontend

### Filter rail and sheet

Desktop: sticky 300px rail from `ui_kits/website/SearchResultsPage.jsx`.
Mobile: bottom sheet from `ui_kits/mobile_app/FiltersSheet.jsx` — segmented type control, budget range, city, amenity chips.

Same state, two presentations. One `useFilters()` hook driving both, so a filter added later appears in both without being implemented twice.

### The chip rule that is easy to miss

From the design system:

> Selected filter chips invert to **charcoal**, not terracotta, so selection never competes with the primary action.

Terracotta is reserved for the single primary action on screen. A row of terracotta chips destroys that hierarchy. Use `--sable-900` fill with `--text-on-inverse`.

### URL state

Every filter in the URL, so a search is shareable and survives refresh:

```
/listings?city=Rabat&neighborhood=Agdal,Hassan&priceMax=4000&amenities=wifi,parking&sort=price-asc
```

English parameter names, matching the API. One less mapping layer, and one less place for a filter to be dropped in translation. Displayed copy stays French; the URL is structure.

Debounce the price range at ~400ms; fire immediately on chip toggles. A range slider that fires per pixel will hammer the API.

### Result count on the button

*"Voir 32 annonces"* — the copy rules require specific, verb-first buttons with real numbers. This needs a count from the API, which the cursor-paginated search does not return. Options: a separate lightweight `COUNT` query behind the filter sheet, or an approximate count from `EXPLAIN`. A separate count is fine here — it runs once when the sheet opens, not per page.

### Listing detail

Port `ui_kits/mobile_app/ListingScreen.jsx`: photo header with glass controls, price block, tabs (*logement* / *colocataires* / *règles*), sticky contact bar.

The contact bar opens the phase 04 conversation flow. Price formatting through `format.ts` from phase 03 — never hand-built.

### Map

Leaflet, matching phase 05's wizard map so there is one map library, not two. Pin click opens a `ListingCard` overlay. Sync bounds to the URL if you want a shareable map view, but the flat per-city endpoint does not require it.

---

## 7. Tests

| Test | Asserts |
| --- | --- |
| **Two amenities selected** | **AND — both required** |
| Two property types | OR — either matches |
| Amenities + price + type | Categories AND'd together |
| Living preference on unanswered listing | Excluded, not included |
| `availableBy` | `available_from <= date` |
| `CLOSEST` without coordinates | 400 |
| City + radius together | 400 |
| Radius over cap | 400 |
| All filters at once | `EXPLAIN` shows no sequential scan |
| Map response | Fuzzed coordinates, deterministic across calls |
| Every sort | Correct order, cursor stable |

Run the full-filter `EXPLAIN` at 100k rows, not 10k. Postgres will pick a sequential scan on a small table regardless of what you index.

---

## 8. Done checklist

- [ ] Every §5 filter category works and composes per the rules
- [ ] A test proves amenities AND rather than OR
- [ ] All six sorts work; `CLOSEST` rejects cleanly without a reference point
- [ ] Radius and area modes cannot both be active
- [ ] Query plans healthy with every filter applied, at 100k rows
- [ ] Map shows fuzzed, stable pins
- [ ] Filter UI matches both mockups; filtered URLs are shareable
- [ ] Listing detail complete and reachable from search
- [ ] **Written down:** the `RECOMMENDED` scoring formula, and whether the `ORDER BY` was split per sort mode
