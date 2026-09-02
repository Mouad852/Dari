# Guide — Phase 02: PostGIS search + the listing lifecycle

Implementation guide for [`02-vertical-slice-search-and-lifecycle.md`](../02-vertical-slice-search-and-lifecycle.md).

**The most important guide in the set.** This phase resolves three open questions the plan deliberately left open. All three are answered below with reasoning — overrule any of them, but do it now rather than in month three.

Keep the slice thin. Title, city, neighborhood, price, coordinates, both state enums, timestamps. No amenities, rooms, house rules or photos — those are phase 05.

---

## 0. The three decisions, resolved

### Decision 1 — geography column: generated, not trigger, not application-set

```sql
location geography(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
) STORED
```

`ST_MakePoint`, `ST_SetSRID` and the geography cast are all `IMMUTABLE`, which is what a stored generated column requires. Postgres 12+ only — the pinned image is 16.

Why not the alternatives: a trigger is invisible to anyone reading the schema and silently skipped by `COPY` during bulk seeding; application-set means the column can drift from lat/lng the moment one code path forgets it. A generated column **cannot** drift, and that is worth more than the flexibility you lose.

Verify the syntax against your actual image before building on it:

```bash
docker compose exec db psql -U dari -d dari -c \
  "CREATE TABLE t(lat double precision, lng double precision,
   g geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography) STORED);
   DROP TABLE t;"
```

### Decision 2 — the distance cursor: keyset on `(distance, id)`, reference point echoed in the cursor

This is the tension the plan flagged. The resolution is that **distance from a fixed reference point is stable for the duration of a query**, so it is a legal keyset column — as long as the reference point is carried in the cursor rather than re-supplied by the client.

Cursor payload, base64url-encoded JSON:

```json
{ "s": "DISTANCE", "ref": [33.9716, -6.8498], "d": 1843.2, "id": "0192f3c1-..." }
{ "s": "RECENT",   "t": "2026-08-20T14:22:03Z", "id": "0192f3c1-..." }
```

The comparison uses a row-value expression, which Postgres can drive from a compound index:

```sql
-- distance mode
WHERE (ST_Distance(l.location, :ref), l.id) > (:lastDistance, :lastId)
ORDER BY ST_Distance(l.location, :ref), l.id

-- recency mode
WHERE (l.created_at, l.id) < (:lastCreatedAt, :lastId)
ORDER BY l.created_at DESC, l.id DESC
```

Three rules that make this correct rather than nearly correct:

- **`id` is the tiebreaker in every mode.** Without it, two listings at identical distance or timestamp can be skipped or duplicated across pages.
- **The reference point comes from the cursor, not the request**, on every page after the first. If the client re-sends a slightly different `lat`/`lng`, the ordering shifts underneath the cursor and rows are lost.
- **Reject a cursor whose `s` disagrees with the requested sort.** Changing sort mode mid-pagination must start a new page-1, not silently mis-paginate.

No offset fallback is needed. If this turns out to be wrong under load, the fallback is capping distance-sorted results at a few hundred rows — but measure before conceding that.

### Decision 3 — fuzzing: deterministic ~200m offset, applied at a DTO chokepoint

The plan left the radius unspecified. **200 m** is the recommendation: enough to obscure which building on a street, small enough that the pin still reads as "Agdal, near the tram" — which is the granularity the design doc's own example implies.

It must be **deterministic per listing**. A random offset per request makes map pins visibly jitter and, worse, lets an attacker average many requests to recover the true point. Derive the offset from the listing id:

```java
public final class LocationFuzzer {
    private static final double RADIUS_M = 200.0;

    public static double[] fuzz(UUID listingId, double lat, double lng) {
        // Deterministic per listing: same input, same output, forever.
        long seed = listingId.getMostSignificantBits() ^ listingId.getLeastSignificantBits();
        var rnd = new Random(seed);
        double angle = rnd.nextDouble() * 2 * Math.PI;
        double dist  = Math.sqrt(rnd.nextDouble()) * RADIUS_M;   // sqrt = uniform over the disc

        double dLat = (dist * Math.cos(angle)) / 111_320.0;
        double dLng = (dist * Math.sin(angle)) / (111_320.0 * Math.cos(Math.toRadians(lat)));
        return new double[]{ lat + dLat, lng + dLng };
    }
}
```

`sqrt(random)` gives a uniform distribution over the disc; without it, offsets cluster toward the centre and the fuzzing is weaker than it looks.

**Structural enforcement matters more than the algorithm.** Make it impossible to serialize an exact coordinate on a public path by giving the public DTO no field that could hold one:

```java
/** Public listing projection. Deliberately has no exact-coordinate field. */
public record PublicListingResponse(
        UUID id, String title, String city, String neighborhood,
        BigDecimal priceRent,
        double displayLatitude,     // fuzzed, always
        double displayLongitude,    // fuzzed, always
        ListingStatus status, AvailabilityState availabilityState,
        Instant createdAt) {

    public static PublicListingResponse of(Listing l) {
        double[] f = LocationFuzzer.fuzz(l.getId(), l.getLatitude(), l.getLongitude());
        return new PublicListingResponse(l.getId(), l.getTitle(), l.getCity(),
                l.getNeighborhood(), l.getPriceRent(), f[0], f[1],
                l.getStatus(), l.getAvailabilityState(), l.getCreatedAt());
    }
}
```

Never expose the entity directly, and never add a `latitude` field to this record. Phase 10's security review checks exactly this.

One consequence to accept knowingly: **distances returned to the client should be rounded** (to ~100 m), or a determined attacker can triangulate the true point from several radius queries. Round it at the same chokepoint.

---

## 1. Migration

`V3__listings_slice.sql`:

```sql
CREATE TYPE listing_status     AS ENUM
    ('DRAFT','PENDING_REVIEW','PUBLISHED','REJECTED','SUSPENDED','EXPIRED');
CREATE TYPE availability_state AS ENUM ('AVAILABLE','ROOM_FOUND','CLOSED');

CREATE TABLE listings (
    id                 UUID PRIMARY KEY,
    owner_id           UUID NOT NULL REFERENCES users(id),
    title              TEXT NOT NULL,
    city               TEXT NOT NULL,
    neighborhood       TEXT NOT NULL,
    latitude           DOUBLE PRECISION NOT NULL,
    longitude          DOUBLE PRECISION NOT NULL,
    location           geography(Point, 4326) GENERATED ALWAYS AS (
                           ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
                       ) STORED,
    price_rent         NUMERIC(10,2) NOT NULL CHECK (price_rent >= 0),
    status             listing_status     NOT NULL DEFAULT 'DRAFT',
    availability_state availability_state NOT NULL DEFAULT 'AVAILABLE',
    prior_status       listing_status,          -- phase 06: restore after dismissed auto-suspension
    deleted_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (latitude  BETWEEN -90  AND 90),
    CHECK (longitude BETWEEN -180 AND 180)
);

-- Spatial index. GiST, not BRIN: listings cluster by city, not by insertion order.
CREATE INDEX idx_listings_location ON listings USING GIST (location);

-- The searchable set is a small fraction of the table. A partial index keeps it small
-- and makes the baseline filter almost free.
CREATE INDEX idx_listings_searchable
    ON listings (city, created_at DESC, id DESC)
    WHERE status = 'PUBLISHED'
      AND availability_state = 'AVAILABLE'
      AND deleted_at IS NULL;

CREATE INDEX idx_listings_searchable_price
    ON listings (city, price_rent)
    WHERE status = 'PUBLISHED'
      AND availability_state = 'AVAILABLE'
      AND deleted_at IS NULL;

CREATE INDEX idx_listings_owner ON listings (owner_id, created_at DESC);
```

`prior_status` is added now, unused until phase 06. It has to be captured *at the moment of auto-suspension*, and adding the column later means the first suspensions cannot be restored.

---

## 2. Enforcing the search invariant structurally

`status = PUBLISHED AND availability_state = AVAILABLE` is the line between a moderated marketplace and a scam board. It must be impossible to forget, not merely easy to remember.

**Use a database view as the only public read surface.**

`V4__published_listings_view.sql`:

```sql
CREATE VIEW published_listings AS
SELECT * FROM listings
WHERE status = 'PUBLISHED'
  AND availability_state = 'AVAILABLE'
  AND deleted_at IS NULL;
```

Then split the repositories so the type system carries the distinction:

```java
/** Public search. Reads the view — the invariant cannot be bypassed from here. */
public interface PublishedListingRepository extends Repository<Listing, UUID> { /* view-backed */ }

/** Owner and admin access. Reads the table. Every method must justify itself. */
public interface ListingRepository extends JpaRepository<Listing, UUID> { }
```

Why a view rather than a Hibernate `@Filter` or a repository base class: a filter can be disabled per session and a base class can be bypassed by writing one native query. A view is enforced by Postgres and shows up in `EXPLAIN`. The cost is that native PostGIS queries must target `published_listings` — which is the point.

Add an architecture test so the rule is mechanically checked rather than culturally maintained:

```java
@Test void publicSearchNeverTouchesTheListingsTableDirectly() {
    // ArchUnit: nothing under ma.dari.api.listing.search may reference
    // ListingRepository or the string "FROM listings".
}
```

---

## 3. The lifecycle state machine

Both dimensions as explicit transition tables, guarded at one chokepoint.

```java
public enum ListingStatus { DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED, SUSPENDED, EXPIRED }

public final class ListingStatusMachine {

    private static final Map<ListingStatus, Set<ListingStatus>> LEGAL = Map.of(
        DRAFT,          EnumSet.of(PENDING_REVIEW),
        PENDING_REVIEW, EnumSet.of(PUBLISHED, REJECTED),
        REJECTED,       EnumSet.of(PENDING_REVIEW),
        PUBLISHED,      EnumSet.of(SUSPENDED, EXPIRED),
        SUSPENDED,      EnumSet.of(PUBLISHED),          // admin only, never automatic
        EXPIRED,        EnumSet.of(PENDING_REVIEW)      // renewal re-enters review
    );

    public static void assertLegal(ListingStatus from, ListingStatus to) {
        if (!LEGAL.getOrDefault(from, Set.of()).contains(to))
            throw new ApiException(409, ErrorCode.ILLEGAL_TRANSITION,
                    "Transition impossible depuis cet état");
    }
}
```

```java
public final class AvailabilityMachine {
    private static final Map<AvailabilityState, Set<AvailabilityState>> LEGAL = Map.of(
        AVAILABLE,  EnumSet.of(ROOM_FOUND),
        ROOM_FOUND, EnumSet.of(AVAILABLE, CLOSED),
        CLOSED,     EnumSet.noneOf(AvailabilityState.class)   // terminal
    );
    // assertLegal as above
}
```

Read the transitions straight off design doc §4 and check them against this table before trusting it. Two that are easy to get wrong:

- **`PUBLISHED` does not transition to `PENDING_REVIEW`.** Editing a published listing leaves it published (§4). If your table allows it, an edit will silently unpublish someone's listing.
- **`SUSPENDED → PUBLISHED` is admin-only.** Never automatic, never on owner edit.

Route every change through one method so the guard cannot be skipped:

```java
@Transactional
public Listing transition(Listing l, ListingStatus target, TransitionActor actor) {
    ListingStatusMachine.assertLegal(l.getStatus(), target);
    if (target == SUSPENDED) l.setPriorStatus(l.getStatus());   // phase 06 needs this
    l.setStatus(target);
    l.setUpdatedAt(Instant.now());
    return l;
}
```

### Endpoints

```
POST /api/v1/listings/{id}/submit            DRAFT|REJECTED|EXPIRED -> PENDING_REVIEW   (owner)
POST /api/v1/listings/{id}/mark-room-found    AVAILABLE  -> ROOM_FOUND                   (owner)
POST /api/v1/listings/{id}/reopen             ROOM_FOUND -> AVAILABLE                    (owner)
```

Ownership checked on all three. A non-owner gets **404, not 403** — a 403 confirms the listing exists.

---

## 4. The search query

One native query, assembled with a small builder. Do not attempt this in JPQL; PostGIS functions and row-value keyset comparison do not survive it.

```sql
SELECT l.id, l.title, l.city, l.neighborhood, l.latitude, l.longitude,
       l.price_rent, l.status, l.availability_state, l.created_at,
       CASE WHEN :refPoint IS NOT NULL
            THEN ST_Distance(l.location, :refPoint) END AS distance_m
FROM published_listings l
WHERE (:city         IS NULL OR l.city = :city)
  AND (:hoods        IS NULL OR l.neighborhood = ANY(:hoods))
  AND (:priceMin     IS NULL OR l.price_rent >= :priceMin)
  AND (:priceMax     IS NULL OR l.price_rent <= :priceMax)
  AND (:refPoint     IS NULL OR ST_DWithin(l.location, :refPoint, :radiusM))
  -- keyset, one branch active per request
  AND (:cursorRecentTs IS NULL OR (l.created_at, l.id) < (:cursorRecentTs, :cursorId))
  AND (:cursorDist     IS NULL OR (ST_Distance(l.location, :refPoint), l.id) > (:cursorDist, :cursorId))
ORDER BY
  CASE WHEN :sort = 'DISTANCE' THEN ST_Distance(l.location, :refPoint) END ASC NULLS LAST,
  CASE WHEN :sort = 'PRICE_ASC' THEN l.price_rent END ASC,
  CASE WHEN :sort = 'RECENT' THEN l.created_at END DESC,
  l.id DESC
LIMIT :limit + 1;
```

Notes:

- **`ST_DWithin`, never `ST_Distance(...) < r`.** Only `ST_DWithin` uses the GiST index; the comparison form computes distance for every row in the table. This single line is the difference between a millisecond and a full scan.
- **Fetch `limit + 1`** to know whether a next page exists without a second `COUNT`.
- **`radiusM` in metres**, because the column is `geography` not `geometry`. If you ever see distances that look like degrees, the cast was lost.
- The multi-branch `ORDER BY` is readable but can defeat index-driven sorting. If `EXPLAIN` shows a sort node on a large row count, **split into separate query strings per sort mode**. That is the pragmatic fix, and it is fine.

### Mutual exclusion

City/neighborhood mode and radius mode are mutually exclusive (§5). Reject the combination explicitly rather than silently preferring one:

```java
if (req.hasRadius() && (req.city() != null || req.neighborhoods() != null))
    throw new ApiException(400, ErrorCode.CONFLICTING_FILTERS,
            "Choisissez une ville ou une recherche par rayon");
```

---

## 5. Seed data

Realism matters here. Uniformly random coordinates across a city make radius search look better than it is, because real listings cluster and clustered data stresses the index differently.

```java
// Cluster around real neighborhood centroids with a ~1.5km spread,
// then add a thin uniform scatter so the index sees both shapes.
record Hood(String city, String name, double lat, double lng) {}

static final List<Hood> HOODS = List.of(
    new Hood("Rabat", "Agdal",     33.9935, -6.8650),
    new Hood("Rabat", "Hassan",    34.0170, -6.8320),
    new Hood("Rabat", "Hay Riad",  33.9540, -6.8700),
    new Hood("Casablanca", "Maârif",   33.5850, -7.6320),
    new Hood("Casablanca", "Gauthier", 33.5890, -7.6250)
    // ... Marrakech, Tanger
);
```

Take the neighborhood names from `flows/listing-creation/Listing Wizard.dc.html` — the `HOODS` constant there is the product's current list.

Target distribution across 10 000 rows: roughly 60% `PUBLISHED`+`AVAILABLE`, 15% `PENDING_REVIEW`, 10% `PUBLISHED`+`ROOM_FOUND`, 8% `DRAFT`, 5% `SUSPENDED`, 2% soft-deleted. The non-searchable 40% is the point — it is what proves the invariant holds.

Load with `COPY`, not 10 000 inserts. The generated column is populated by `COPY` correctly, which a trigger-based approach would not guarantee.

---

## 6. Verifying the query plan

Reading the plan is the deliverable, not "it felt fast".

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT l.id, ST_Distance(l.location, ST_SetSRID(ST_MakePoint(-6.8498, 33.9716),4326)::geography) d
FROM published_listings l
WHERE ST_DWithin(l.location, ST_SetSRID(ST_MakePoint(-6.8498,33.9716),4326)::geography, 3000)
ORDER BY d LIMIT 20;
```

What you want to see:

- `Index Scan using idx_listings_location` — **not** `Seq Scan on listings`
- A small `rows removed by filter`
- Execution time in single-digit milliseconds at 10k rows

Run `ANALYZE listings;` after seeding. Postgres will choose a sequential scan on a small table regardless of indexes, so **also test at 100k rows** — otherwise the plan you validate is not the plan you will run.

Argument order for `ST_MakePoint` is **(longitude, latitude)**. Reversing it is the single most common PostGIS bug, and in Morocco it puts every listing in the Indian Ocean — visible, at least, which is a mercy.

---

## 7. Tests

### Transition matrix

Generate it rather than writing 36 cases by hand:

```java
@ParameterizedTest
@MethodSource("allStatusPairs")
void transitionMatrix(ListingStatus from, ListingStatus to) {
    var listing = seed(from);
    if (LEGAL.getOrDefault(from, Set.of()).contains(to))
        assertDoesNotThrow(() -> service.transition(listing, to, ADMIN));
    else
        assertThrows(ApiException.class, () -> service.transition(listing, to, ADMIN));
}
```

### The invariant

| Test | Asserts |
| --- | --- |
| `PUBLISHED` + `ROOM_FOUND` | Absent from search, present in owner's list |
| `PENDING_REVIEW` | Absent from search |
| `SUSPENDED` | Absent from search |
| Soft-deleted | Absent from search |
| Non-owner fetches a `DRAFT` | 404, not 403 |

### Pagination

The one that catches real bugs: **paginate while inserting.**

```java
@Test void cursorIsStableWhileRowsAreInserted() {
    var page1 = search(limit(10));
    insertPublishedListings(50);               // mid-pagination churn
    var page2 = search(limit(10), page1.nextCursor());
    assertThat(idsOf(page1)).doesNotContainAnyElementsOf(idsOf(page2));
}
```

Also: identical timestamps must not lose rows (insert 20 listings with the same `created_at` and page through all of them); and a distance cursor must be rejected when the sort mode changes.

### Fuzzing

```java
@Test void fuzzIsDeterministic() {
    assertThat(fuzz(id, lat, lng)).isEqualTo(fuzz(id, lat, lng));
}

@Test void fuzzStaysWithinRadius() {
    // haversine(original, fuzzed) <= 200m, over 1000 random ids
}

@Test void noPublicResponseContainsExactCoordinates() {
    String json = mockMvc.perform(get("/api/v1/listings")).andReturn()
                         .getResponse().getContentAsString();
    assertThat(json).doesNotContain("\"latitude\"").doesNotContain("\"longitude\"");
}
```

---

## 8. Done checklist

- [ ] Generated geography column verified against the real image
- [ ] `EXPLAIN ANALYZE` shows a GiST index scan at 100k rows, no sequential scan
- [ ] Cursor stable across both sort modes under concurrent inserts
- [ ] Transition matrix green, illegal transitions return 409
- [ ] An ArchUnit test prevents public search from reaching the `listings` table
- [ ] No public response contains an exact coordinate
- [ ] **Written down in this file:** the fuzzing radius chosen, and whether the multi-branch `ORDER BY` survived or was split per sort mode

## Carry into later phases

- The cursor encoder — phase 04 paginates messages and phase 07 adds four more sorts to this query
- `prior_status`, captured on suspension, consumed in phase 06
- `LocationFuzzer` and the DTO chokepoint — phase 08 exposes listings to crawlers, which is the widest possible distribution of any leak
- Whichever `ORDER BY` shape survived, because phase 07 extends it
