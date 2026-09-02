# Guide — Phase 05: Listing creation

Implementation guide for [`05-listing-creation.md`](../05-listing-creation.md).

The largest phase. If it needs splitting, the seam is **backend write model first, wizard second** — the API is testable without the wizard, the wizard is useless without the API.

**Read `flows/listing-creation/Listing Wizard.dc.html` before writing the API.** It is a working prototype, not a sketch, and it encodes product decisions the design doc never states. Its `HOODS`, `ROOM_TYPES` and `AMENITIES` constants are the current product taxonomy.

---

## 0. Decisions to settle first

**Draft persistence → server-side `DRAFT` rows from step 1.** The wizard header already promises *"Brouillon enregistré"*, so it has to be true, and true across devices. The cost is partial listings in the database from the first keystroke — acceptable, since `DRAFT` is invisible to everyone but the owner and phase 02's invariant already guarantees that. Local-storage drafts do not survive a device change and would make the header a lie.

**Photo limits → 1 minimum, 20 maximum, 10 MB per file, resized server-side to max 2000px on the long edge.** The doc specifies only the minimum. Twenty is generous for a room listing; 10 MB accommodates a modern phone photo without inviting abuse.

**EXIF → strip everything, unconditionally.** Not just GPS. Camera serial numbers and timestamps are also identifying, and there is no case where a listing photo's metadata benefits anyone.

---

## 1. Migrations

`V8__listing_full_model.sql` — expand `listings` to the full §3 column set:

```sql
CREATE TYPE property_type    AS ENUM ('APARTMENT','HOUSE','STUDIO');
CREATE TYPE room_type        AS ENUM ('PRIVATE','SHARED');
CREATE TYPE room_furnishing  AS ENUM ('FULLY_FURNISHED','PARTIALLY_FURNISHED','UNFURNISHED');
CREATE TYPE charge_inclusion AS ENUM ('INCLUDED','NOT_INCLUDED','NA');
CREATE TYPE listing_room_type AS ENUM
    ('BEDROOM','SALON','KITCHEN','BATHROOM','TERRACE','STORAGE');

ALTER TABLE listings
    ADD COLUMN description             TEXT,
    ADD COLUMN price_deposit           NUMERIC(10,2) CHECK (price_deposit >= 0),
    ADD COLUMN wifi_included           charge_inclusion NOT NULL DEFAULT 'NA',
    ADD COLUMN electricity_included    charge_inclusion NOT NULL DEFAULT 'NA',
    ADD COLUMN water_included          charge_inclusion NOT NULL DEFAULT 'NA',
    ADD COLUMN property_type           property_type,
    ADD COLUMN num_bedrooms            SMALLINT CHECK (num_bedrooms  BETWEEN 0 AND 20),
    ADD COLUMN num_bathrooms           SMALLINT CHECK (num_bathrooms BETWEEN 0 AND 20),
    ADD COLUMN room_type               room_type,
    ADD COLUMN room_furnishing         room_furnishing,
    ADD COLUMN common_areas_furnished  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN current_roommates_count SMALLINT CHECK (current_roommates_count BETWEEN 0 AND 20),
    ADD COLUMN max_roommates           SMALLINT CHECK (max_roommates BETWEEN 1 AND 20),
    ADD COLUMN available_from          DATE,
    ADD COLUMN min_stay_months         SMALLINT CHECK (min_stay_months BETWEEN 1 AND 36),
    ADD COLUMN rejection_reason        TEXT;
```

Everything is nullable. A `DRAFT` created at step 1 has none of it yet — **the constraints that matter are enforced at submit, not at insert.** This is the central schema consequence of server-side drafts.

```sql
CREATE TABLE listing_rooms (
    id          UUID PRIMARY KEY,
    listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    room_type   listing_room_type NOT NULL,
    is_rentable BOOLEAN NOT NULL DEFAULT FALSE,
    is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    sort_order  SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_listing_rooms_listing ON listing_rooms (listing_id, sort_order);

CREATE TABLE amenities (
    id       UUID PRIMARY KEY,
    code     TEXT NOT NULL UNIQUE,      -- 'wifi', 'lave', matching the wizard
    label_fr TEXT NOT NULL,
    icon     TEXT NOT NULL,             -- Lucide glyph name
    sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE listing_amenities (
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    amenity_id UUID NOT NULL REFERENCES amenities(id),
    PRIMARY KEY (listing_id, amenity_id)
);
-- Reverse index: phase 07's amenity AND-filter drives from amenity_id.
CREATE INDEX idx_listing_amenities_amenity ON listing_amenities (amenity_id, listing_id);

CREATE TABLE house_rules (
    listing_id       UUID PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
    smoking_allowed  BOOLEAN,
    pets_allowed     BOOLEAN,
    guests_allowed   BOOLEAN,
    quiet_hours_start TIME,
    quiet_hours_end   TIME,
    other_rules      TEXT
);

CREATE TABLE listing_photos (
    id         UUID PRIMARY KEY,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_cover   BOOLEAN NOT NULL DEFAULT FALSE,
    width      INT, height INT, bytes INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_listing_photos_listing ON listing_photos (listing_id, sort_order);

-- Exactly one cover per listing, enforced by the database rather than by discipline.
CREATE UNIQUE INDEX idx_listing_photos_one_cover
    ON listing_photos (listing_id) WHERE is_cover;
```

That partial unique index is worth the line. "Exactly one cover" enforced in application code drifts the first time two requests race.

### Seeding amenities

Take the codes from the wizard verbatim so the prototype and production agree:

```sql
INSERT INTO amenities (id, code, label_fr, icon, sort_order) VALUES
  (gen_random_uuid(),'wifi',    'Wifi fibre',           'wifi',              1),
  (gen_random_uuid(),'lave',    'Lave-linge',           'washing-machine',   2),
  (gen_random_uuid(),'parking', 'Parking',              'car',               3),
  (gen_random_uuid(),'cuisine', 'Cuisine équipée',      'utensils',          4),
  (gen_random_uuid(),'meuble',  'Chambre meublée',      'bed-double',        5),
  (gen_random_uuid(),'terrasse','Terrasse',             'sun',               6),
  (gen_random_uuid(),'menage',  'Ménage inclus',        'sparkles',          7),
  (gen_random_uuid(),'entree',  'Entrée indépendante',  'key-round',         8),
  (gen_random_uuid(),'gardien', 'Gardien',              'shield-check',      9),
  (gen_random_uuid(),'bureau',  'Coin bureau',          'calendar',         10);
```

**Confirm this list as product data before it becomes a migration.** These are prototype values. Adding an amenity later is a one-row insert; renaming or removing one after listings reference it is not.

Neighborhoods likewise: the wizard's `HOODS` covers Rabat (5), Casablanca (5), Marrakech (4), Tanger (4). Put them in a reference table rather than a Java enum — you will want to add neighborhoods without a deploy.

---

## 2. Validation: two tiers

This is the part most likely to be got wrong, so make the distinction explicit in the code.

```java
/** Draft-tier: applied on every PATCH. Only what must never be wrong. */
public record UpdateListingRequest(
        @Size(max = 120) String title,
        @DecimalMin("0") BigDecimal priceRent,
        @Min(-90) @Max(90) Double latitude,
        // ... everything optional
) {}

/** Submit-tier: applied only on POST /submit. The real completeness rules. */
@Component
public class ListingSubmissionValidator {

    public void validate(Listing l) {
        var errors = new LinkedHashMap<String,String>();

        require(errors, l.getTitle(),        "title",        "Titre requis");
        require(errors, l.getCity(),         "city",         "Ville requise");
        require(errors, l.getNeighborhood(), "neighborhood", "Quartier requis");
        require(errors, l.getPriceRent(),    "priceRent",    "Loyer requis");
        require(errors, l.getPropertyType(), "propertyType", "Type de logement requis");
        require(errors, l.getRoomType(),     "roomType",     "Type de chambre requis");

        if (l.getLatitude() == null || l.getLongitude() == null)
            errors.put("location", "Placez le logement sur la carte");

        if (l.getPhotos().isEmpty())
            errors.put("photos", "Une photo minimum");            // §3, hard requirement

        if (l.getRooms().stream().noneMatch(ListingRoom::isRentable))
            errors.put("rooms", "Indiquez la pièce proposée");

        if (!neighborhoods.belongsTo(l.getCity(), l.getNeighborhood()))
            errors.put("neighborhood", "Ce quartier n'est pas dans cette ville");

        if (l.getAvailableFrom() != null && l.getAvailableFrom().isBefore(LocalDate.now()))
            errors.put("availableFrom", "Date de disponibilité passée");

        if (!errors.isEmpty())
            throw new ApiValidationException("Annonce incomplète", errors);
    }
}
```

Return **all** failures at once with field keys, not the first one. The wizard has eight steps; telling a user about one missing field per round-trip is a miserable experience and the reason people abandon listing flows.

The `fields` map goes straight into the phase 01 error envelope, and the wizard maps keys to steps so it can jump the user to the right one.

---

## 3. The editing rule

§4: **editing a `PUBLISHED` listing does not send it back to review.** Easy to violate by accident, so make it explicit and test it:

```java
@Transactional
public Listing update(Listing listing, User actor, UpdateListingRequest req) {
    requireOwner(listing, actor);
    if (listing.getStatus() == CLOSED_TO_EDITS)
        throw new ApiException(409, ErrorCode.NOT_EDITABLE, "Annonce non modifiable");

    applyPatch(listing, req);
    listing.setUpdatedAt(Instant.now());

    // Deliberately NO status transition here. A published listing stays published.
    // Moderation gaps this opens are covered by the reporting system (§4).
    return listing;
}
```

Leave that comment in. Someone — possibly you, in four months — will otherwise "fix" it.

---

## 4. Photos

### Storage abstraction

```java
public interface PhotoStorage {
    StoredPhoto store(UUID listingId, InputStream in, String contentType);
    void delete(String key);
    String urlFor(String key);
}
```

`LocalDiskPhotoStorage` now, `S3PhotoStorage` later, no caller changes. Store the **key** in `listing_photos.url`, not an absolute URL — otherwise moving to MinIO means rewriting every row.

### Processing pipeline

```java
public StoredPhoto process(UUID listingId, MultipartFile file) {
    if (file.getSize() > 10 * 1024 * 1024)
        throw new ApiException(413, ErrorCode.FILE_TOO_LARGE, "Photo trop lourde (10 Mo maximum)");

    // Sniff the real type. Never trust the declared content-type or the extension.
    String type = detectContentType(file.getInputStream());
    if (!Set.of("image/jpeg","image/png","image/webp").contains(type))
        throw new ApiException(415, ErrorCode.UNSUPPORTED_TYPE, "Format non pris en charge");

    BufferedImage img = ImageIO.read(file.getInputStream());
    if (img.getWidth() < 640 || img.getHeight() < 480)
        throw new ApiException(422, ErrorCode.IMAGE_TOO_SMALL, "Photo trop petite");

    BufferedImage resized = resizeToMaxEdge(img, 2000);

    // Re-encoding through BufferedImage drops ALL metadata, including GPS.
    // This is the fuzzing hole: a user's own photo can carry the exact address.
    return storage.store(listingId, encodeJpeg(resized, 0.85f), "image/jpeg");
}
```

Re-encoding is what strips EXIF — there is no separate "strip metadata" step, and that is a feature, because it cannot be forgotten.

### Cover semantics

```java
@Transactional
public void setCover(Listing l, UUID photoId) {
    l.getPhotos().forEach(p -> p.setCover(false));
    findPhoto(l, photoId).setCover(true);
}
```

Flush order matters: the partial unique index will reject an intermediate state with two covers. Clear first, then set, in one flush — or drop to a single `UPDATE ... SET is_cover = (id = :photoId)`.

First photo uploaded becomes the cover automatically. Deleting the cover promotes the next by `sort_order`. Never leave a listing with photos and no cover.

---

## 5. Endpoints

```
POST   /api/v1/listings                      create DRAFT
GET    /api/v1/listings/{id}                 owner sees own DRAFT; stranger 404s on non-published
PATCH  /api/v1/listings/{id}                 owner edit, no re-review
DELETE /api/v1/listings/{id}                 soft-delete
POST   /api/v1/listings/{id}/submit          submit-tier validation, -> PENDING_REVIEW
POST   /api/v1/listings/{id}/photos          multipart
PATCH  /api/v1/listings/{id}/photos/{pid}    sort_order / is_cover
DELETE /api/v1/listings/{id}/photos/{pid}
GET    /api/v1/listings/mine                 owner dashboard
```

`GET /listings/{id}` is the one route with dual behavior:

```java
public ListingResponse get(UUID id, @Nullable User viewer) {
    var listing = listings.findActiveById(id).orElseThrow(this::notFound);
    boolean isOwner = viewer != null && listing.getOwnerId().equals(viewer.getId());

    if (isOwner) return OwnerListingResponse.of(listing);           // exact coords, status, reason

    if (listing.getStatus() != PUBLISHED || listing.getAvailabilityState() != AVAILABLE)
        throw notFound();                                          // 404, never 403

    return PublicListingResponse.of(listing);                      // fuzzed, phase 02 chokepoint
}
```

Two different response types, not one with conditional fields. A single DTO with nullable exact coordinates is one `if` away from leaking.

---

## 6. The wizard

Port from `flows/listing-creation/Listing Wizard.dc.html`. The prototype's `Component` class holds the complete state shape — read it as the specification.

### Step map

| # | Step | Fields |
| --- | --- | --- |
| 1 | Informations | title, city, hood, property type |
| 2 | Localisation | map pin (`{x,y}` → lat/lng) |
| 3 | Pièces | repeatable rooms; `offered` = `is_rentable`, `shared` = `is_shared` |
| 4 | Prix | rent, deposit, three charge enums |
| 5 | Équipements | amenity codes |
| 6 | Règles | smoking, pets, guests, quiet hours, other |
| 7 | Photos | upload, drag-reorder, cover = first |
| 8 | Vérification | review, publish |

### Draft autosave

```tsx
const save = useDebouncedCallback(
  (patch: Partial<ListingDraft>) => api.patch(`/listings/${id}`, patch),
  1200
);
```

Debounce at ~1.2s, save on step change and on blur, show the *"Brouillon enregistré"* state only after a confirmed 200 — never optimistically. A header that claims a save that did not happen is worse than no header.

### Map pin

The prototype uses a fake `{x, y}` percentage on a placeholder image. Production needs a real map:

```tsx
<MapContainer center={CITY_CENTERS[city]} zoom={14}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
             attribution="&copy; OpenStreetMap" />
  <Marker position={pin} draggable eventHandlers={{ dragend: e => setPin(e.target.getLatLng()) }} />
</MapContainer>
```

**Coordinates are never typed** (§3) — drag only. Re-centre when the city changes, and require the pin to move at least once before step 2 passes, or every listing sits on the city centroid.

Check the OSM tile usage policy before launch; heavy production use expects your own tiles or a paid provider.

### Photo step

`@dnd-kit/sortable` for reordering. First position is the cover, which matches the prototype's rule and the design system's photo-first card.

At 375px the responsive sheet specifies a different shape: full-width cover, then a thumbnail strip, tap to promote. Not a scaled-down grid — build both.

### Validation mapping

```ts
const FIELD_TO_STEP: Record<string, number> = {
  title: 1, city: 1, neighborhood: 1, propertyType: 1,
  location: 2, rooms: 3, priceRent: 4, photos: 7,
};
```

On a submit failure, jump to the lowest failing step and mark every other failing step in the sidebar. The sidebar already renders per-step state in the prototype.

### Owner dashboard — no mockup

Build from `ListingCard` (horizontal variant) plus `Badge` for status. Must show: status per listing, **rejection reason when `REJECTED`**, resubmit, edit, mark-room-found, reopen.

The rejection reason is the highest-value element on the screen — it is the only channel telling an owner why their listing was refused. Do not bury it in a tooltip.

---

## 7. Tests

| Test | Asserts |
| --- | --- |
| Create draft, patch across 8 steps, submit | Full round-trip |
| Submit with no photo | 400, `fields.photos` present |
| Submit incomplete | **All** failures returned at once |
| Neighborhood not in city | Rejected |
| Edit a `PUBLISHED` listing | Still `PUBLISHED` |
| Upload JPEG with GPS EXIF | Stored file has none |
| Upload a renamed `.exe` | 415 |
| Upload 21st photo | Rejected |
| Delete cover photo | Next photo becomes cover |
| Two concurrent `setCover` | One wins, no two-cover state |
| Stranger fetches `DRAFT` | 404 |
| Owner fetches own `DRAFT` | 200, exact coordinates |
| Submitted listing | `PENDING_REVIEW`, absent from search |

The EXIF test needs a real fixture — generate a JPEG with GPS tags and assert the stored bytes contain no EXIF marker.

---

## 8. Done checklist

- [ ] Draft survives browser close and resumes on another device
- [ ] Submit without a photo refused, in French, with the field key
- [ ] Rooms, amenities, house rules, photos all round-trip
- [ ] Editing published leaves it published
- [ ] Wizard matches the prototype at 375px and 1440px
- [ ] Stored photos carry no GPS metadata
- [ ] Submitted listings sit in `PENDING_REVIEW`, invisible in search
- [ ] Owner dashboard shows status and rejection reasons
- [ ] **Confirmed as product data:** the amenity list and the per-city neighborhoods

## Carry into phase 06

- `rejection_reason`, written by the admin reject action
- `prior_status` from phase 02, captured on suspension
- The owner dashboard, which is where moderation outcomes surface
- Listings in `PENDING_REVIEW` — phase 06 is what finally lets them out
