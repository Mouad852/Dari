# Naming — French or English

Dari is a French product built in an English-language stack. Getting the boundary
wrong is not a style problem; it is the thing that makes you stop and think
"was it `annonce` or `listing` here?" forty times a day.

This project has already implemented the product surface with this rule in place,
so the naming boundary is now a real working convention rather than a theoretical
recommendation.

---

## The rule

> **English for everything a developer types. French for everything a user reads.**

The test is one question, and it is not about which layer you are in:

**Could a user ever see this exact string?**
No → English. Yes → French.

A status column holds `ROOM_FOUND` because nobody sees it. The badge above it
says *Chambre trouvée* because someone does. Both describe the same fact; only
one is a word in the product.

### Why not French throughout, since the product is French?

Because you would be the only French speaker in the room. `findByFirebaseUid`,
`@RestController`, `useEffect`, `ST_DWithin`, `NOT NULL` — the stack is English
and cannot be persuaded otherwise. French identifiers do not remove the language
boundary, they just move it into the middle of every file:
`annonceRepository.findByStatutAndDisponibilite(...)`. Every example you paste
from a library's docs, every Stack Overflow answer, every error message from
Hibernate arrives in English and has to be translated by hand.

The rule above puts the boundary in one place — the render layer — where it is
crossed deliberately, once, through a module built for it.

---

## The table

| Thing | Language | Example |
| --- | --- | --- |
| Java packages, classes, methods, fields | **English** | `ListingService.markRoomFound()` |
| Database tables, columns, enum *types* | **English**, `snake_case` | `listings.price_deposit` |
| Enum *values* | **English**, `SCREAMING_SNAKE` | `PENDING_REVIEW` |
| API paths and query params | **English** | `/api/v1/listings?priceMax=4000` |
| API error `code` | **English** | `PROFILE_NOT_FOUND` |
| API error `message` | **French** | *"Profil introuvable"* |
| TypeScript types, props, functions, file names | **English** | `PublicListing`, `format.ts` |
| Web routes | **English** | `/listings/[id]`, `/publish` |
| Displayed text, labels, placeholders, alt text | **French** | *"Voir 32 annonces"* |
| Email and notification bodies | **French** | *"Votre annonce n'a pas été publiée"* |
| Log messages, exception messages *for developers* | **English** | `"Unhandled exception on {} {}"` |
| Code comments, commit messages, branch names | **English** | |
| Documentation in `docs/` and `plans/` | **English** | |
| CSS custom properties | **frozen** — see below | `--sable-900` |

### The two-message rule for errors

Every failure carries both languages at once, and they have different jobs:

```java
throw new ApiException(404, ErrorCode.PROFILE_NOT_FOUND, "Profil introuvable");
//                          ^ English: the client branches on this
//                                                       ^ French: a human reads this
```

Never branch on the French message, and never show the English code to a user.

---

## Spelling: US English

Not a preference — a coin already flipped. `docs/colocation-platform-design.md`
writes `neighborhood`, CSS writes `color`, and the npm ecosystem is US
throughout. Fighting that means `neighbourhood` in your code sitting next to
`neighborhood` in the schema.

So: `favorite`, `neighborhood`, `color`, `behavior`, `authorization`,
`serialize`, `organize`, `center`, `gray`, `canceled`, `analyze`.

This applies to **identifiers absolutely** and to prose by default. If a document
names an identifier, it spells it the way the code does.

---

## Where translation happens — exactly one place

An enum with a French label written inline at three call sites will acquire three
slightly different French labels. Ban the practice structurally:

```ts
// apps/web/src/lib/labels.ts — the ONLY place an enum value meets French
export const AVAILABILITY_LABELS: Record<AvailabilityState, string> = {
  AVAILABLE: 'Disponible',
  ROOM_FOUND: 'Chambre trouvée',
  CLOSED: 'Annonce fermée',
};
```

Typed as an exhaustive `Record`, so adding an enum value **breaks the build**
until its label exists. That is the whole point: the compiler, not a reviewer,
catches the missing translation.

Rules for this module:

- Keyed by the enum value, never by an index or a display order.
- No logic. If a label depends on context, that is two labels, not a function.
- Numbers, money and dates do **not** live here — they go through `format.ts`,
  which owns the thin-space thousands, the decimal comma and the French date
  forms.

---

## Glossary

The canonical English identifier for each domain concept, and the French the user
sees. When in doubt, this table wins.

| Concept (FR) | Identifier | Shown as |
| --- | --- | --- |
| annonce | `listing` | Annonce |
| colocation | `flatshare` (URLs), `listing` (code) | Colocation |
| colocataire | `roommate` | Colocataire |
| logement | `property` | Logement |
| chambre | `bedroom` / `BEDROOM` | Chambre |
| pièce | `room` | Pièce |
| quartier | `neighborhood` | Quartier |
| loyer | `rent` / `price_rent` | Loyer |
| caution | `deposit` / `price_deposit` | Caution |
| charges | `utilities` | Charges |
| charges comprises | `utilities_included` | Charges comprises |
| meublé | `furnished` | Meublé |
| équipement | `amenity` | Équipement |
| règles de la maison | `house_rules` | Règles de la maison |
| signalement | `report` | Signalement |
| modération | `moderation` | Modération |
| favori | `favorite` | Favori |
| gardien | `concierge` | Gardien |
| ménage | `cleaning` | Ménage |
| lave-linge | `washing_machine` | Lave-linge |
| entrée indépendante | `private_entrance` | Entrée indépendante |
| coin bureau | `desk_space` | Coin bureau |

### Codes to use for reference data

The prototype invented its own keys. These are the ones that ship — English,
stable, and safe to put in a URL:

**Room types** (design doc §3) — `BEDROOM`, `SALON`, `KITCHEN`, `BATHROOM`,
`TERRACE`, `STORAGE`

**Amenities** — `FIBER_WIFI`, `WASHING_MACHINE`, `PARKING`, `EQUIPPED_KITCHEN`,
`FURNISHED_ROOM`, `TERRACE`, `CLEANING_INCLUDED`, `PRIVATE_ENTRANCE`,
`CONCIERGE`, `DESK_SPACE`

**Utilities** — `ELECTRICITY`, `WATER`, `WIFI`;
inclusion is `INCLUDED` / `NOT_INCLUDED` / `NOT_APPLICABLE`

**Property types** — `APARTMENT`, `HOUSE`, `STUDIO`

Amenity codes reach the browser in `?amenities=PARKING,FIBER_WIFI`, so renaming
one later breaks every shared and bookmarked search URL. Treat them as permanent
from the first migration.

---

## Traps

### False friends — the ones that actually occur here

| French | Looks like | Actually |
| --- | --- | --- |
| annonce | announcement | **listing** |
| caution | caution | **deposit** |
| avis | advice | **review** |
| charges | charges (fees) | **utilities** |
| actuel | actual | **current** |
| demande | demand | **request** |
| pièce | piece | **room** |
| location | location | **renting** — see below |

### `location` means two different things

The schema has `listings.location` — a `geography(Point,4326)`, the geographic
point. In French, *location* means **renting**. A French speaker reads
`listing.location` as "the rental" and a English speaker reads it as "the place",
and both are half right.

It is already in the schema and not worth a migration, but **never introduce a
second `location`**. Use `coordinates`, `point` or `approximateLocation` for
geography, and `rental` for the act of renting.

### `--sand-*` and `--sable-*` are different ramps

*Sable* is French for sand. The design system has both: `--sand-*` is the ochre
highlight ramp, `--sable-*` is the warm neutral ramp from cream to charcoal.
They are adjacent in purpose and one keystroke apart.

`--sand-400` as a page background will look wrong in a way that is hard to spot.
When copying a token, copy it — do not type it from memory.

### `TERRACE` is both a room type and an amenity

Two different tables, two different meanings ("the property has a terrace" versus
"a terrace is one of the rooms"). This is correct. Do not deduplicate them.

### Words identical in both languages

`messages`, `photos`, `contact`, `admin`, `description`, `format`, `note`,
`date`, `application`, `transport`, `budget`, `profile`/`profil`.

These feel decided but are not — `profil` and `profile` differ by one letter.
Every one of them is **English** in code, because the rule has no exceptions for
convenience.

---

## Conflicts already in the repository

Found while writing this. Where two sources disagree, the design doc wins,
because it is the one the schema is built from.

**1. The wizard prototype uses French keys.**
`flows/listing-creation/Listing Wizard.dc.html` has room types keyed
`'chambre'`, `'salon'`, `'cuisine'`, `'sdb'`, `'terrasse'`, `'rangement'`, and
amenities keyed `'lave'`, `'menage'`, `'entree'`, `'meuble'`, `'gardien'`.

The design doc specifies `BEDROOM`, `SALON`, `KITCHEN`, `BATHROOM`, `TERRACE`,
`STORAGE`. **The design doc wins.** The prototype is a frozen design artifact —
port its *layout, copy and interaction*, not its data keys. This is the single
most likely place to introduce a mismatch during phase 05.

**2. `INAPPROPRIATE_BEHAVIOUR` was UK-spelled.** Fixed to
`INAPPROPRIATE_BEHAVIOR`, before any migration wrote it into a Postgres enum
type — which would have made it a schema change rather than a rename.

**3. `--sand` / `--sable`.** Cannot be fixed. The design system is treated as an
external dependency; renaming a token would fork it from `design-system/` and
break the `tokens:sync --check` guarantee.

---

## Named exceptions

Four, and only four. Each is a deliberate loanword, not a lapse.

**`SALON`** — a Moroccan salon is not a living room and not a lounge. It is a
specific room type that can legitimately be let as sleeping space, which is why
the design doc models it explicitly. No English word carries that. Already an
enum value in the design doc.

**City slugs** — `rabat`, `casablanca`, `marrakech`, `tanger`. Proper nouns.
`tanger`, not `tangier`: it is the name displayed to users, and slug and label
should not disagree.

**Design tokens** — `--clay`, `--sable`, `--sand`, `--atlas`, `--saffron`,
`--majorelle`. Vendor namespace. Never renamed, never invented.

**`MAD`** — the ISO 4217 code. Not `DH`, not `dirham`, in code.

---

## Adding a new term

1. Is it ever displayed? If not, English only — you are done.
2. Check the glossary above. If the concept is there, use that identifier.
3. If it is new: pick the English term, add it to the glossary, add its French
   label to `labels.ts`.
4. If it will appear in a URL or a database enum, say so out loud — those two
   are effectively permanent.
5. If English has no accurate word, keep the French one and add it to *Named
   exceptions* with the reason. Do not do this to save five minutes of thought.
