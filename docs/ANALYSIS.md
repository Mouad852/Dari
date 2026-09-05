# Analysis of the two sessions, and how they were merged

## What each session produced

**Session 1 — "Dari Design System".** A complete design-system source tree: 8 token files,
17 guideline specimen cards, 16 components in 5 groups (`core`, `forms`, `navigation`,
`feedback`, `listings`), two UI kits (mobile app, marketing website), a `SKILL.md` so the
system can be invoked as an agent skill, and a compiled `_ds_bundle.js` + `_ds_manifest.json`.
No client assets existed at this point — the brief was text only. Everything visual is a
*proposal*: the name "Dari", the hex values, the type scale, the fonts, the Lucide icon set.

**Session 2 — "Listing creation flow".** The 8-step listing wizard, built as two
`.dc.html` documents driven by a `DCLogic` React runtime in `support.js`:

| # | Step | Content |
| --- | --- | --- |
| 1 | Informations | Titre, ville, quartier, type de logement |
| 2 | Localisation | Draggable map pin — no address typed |
| 3 | Pièces | Repeatable room list; which is offered, which is shared |
| 4 | Prix | Loyer, caution, per-charge inclus / non compris / sans objet |
| 5 | Équipements | 10 amenities |
| 6 | Règles | Fumeur, animaux, invités, heures calmes |
| 7 | Photos | Drag-reorder grid, first is cover, minimum one |
| 8 | Vérification | Review and publish |

It ships a responsive proof sheet showing steps 3 and 7 at 375px and 1440px, plus two
screenshots. Its state model covers Rabat / Casablanca / Marrakech / Tanger with real
neighborhoods, `3 200 MAD/mois` with a thin-space separator — it follows the session-1
content rules faithfully.

## The important discovery

Session 2 did **not** just consume session 1's system — it *evolved* it, and vendored the
newer version into `_ds/dari-design-system-d1bbe248…/`. Comparing the two copies:

| Change in the session-2 copy | Status |
| --- | --- |
| `--type-body-sm` type token added | ✅ merged in |
| Every component recompiled (all 16 source hashes differ) | ✅ merged in (bundle) |
| `Icon` rewritten: CSS-mask → inlined SVG children with a fetch cache | ✅ merged in (bundle) |
| New `ui_kits/listing_detail/` kit | ⚠️ compiled only, **no source** |
| New `templates/landing-page/` and `templates/room-app/` | ⚠️ manifest only, **no files** |
| **Client logo supplied** — 6 JPEGs, cleaned to transparent PNGs, three colourways | ❌ **binaries missing** |
| **Client photography supplied** — 6 interiors, cropped per surface | ❌ **binaries missing** |
| Readme rewritten: the name "Dari" is now *confirmed by the client's logo files* | ✅ kept as `readme.v2-notes.md` |

The session-2 export is a runtime snapshot — tokens + bundle + manifest only. It carries no
`assets/`, `components/`, `guidelines/` or `ui_kits/` source. So the newer *compiled* system
survives, but the newer *sources* and every client image binary do not.

The compiled v2 code proves the assets existed — it references `assets/logo-lockup-terracotta.png`,
`assets/photos/detail-header.jpg` and `assets/photos/thread-thumb.jpg`. Those paths currently
resolve to nothing.

## How the merge was resolved

`design-system/` is session 1's **complete source tree**, with session 2's **newer runtime**
promoted over it:

- `tokens/typography.css` → session-2 version (adds `--type-body-sm`, which the wizard uses).
- `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json` → session-2 versions.
- `_legacy-v1-build/` → session-1's bundle and manifest, kept because they are the pair that
  actually matches the on-disk `.jsx` sources.
- `readme.v2-notes.md` → session-2's readme, which documents the logo and photography rules.
  `readme.md` is still session 1's.

All other tokens were byte-identical between the two sessions — the color, spacing, radius,
elevation, motion and font tokens never drifted.

`flows/listing-creation/` is session 2's wizard with its ten vendored
`_ds/dari-design-system-d1bbe248…/` paths per file rewritten to `../../design-system/`.
No other edit was made to the wizard.

### The known inconsistency

`design-system/` now pairs **v1 sources with the v2 compiled bundle**. This is deliberate —
it is the only combination where the wizard runs against exactly the runtime it was authored
for, and the v1 sources are the only sources that exist. Both were verified rendering:
the wizard and the website kit load with no errors beyond a missing favicon.

The hazard to know about: **rebuilding the bundle from the current `.jsx` sources would
silently roll the components back to v1** — losing the v2 `Icon` rewrite and the recompiled
primitives. Do not rebuild until this is reconciled.

## Open items, in priority order

1. **Recover the session-2 assets.** The client logo (6 JPEGs) and the 6 interior photos.
   Re-export the session-2 design-system assets in full if they are still available —
   that also recovers the `listing_detail` kit and the two templates. Otherwise the original
   logo files need re-supplying.
2. **Reconcile sources with the bundle.** Either port the v2 component changes back into the
   `.jsx` files, or accept v1 sources and rebuild — a decision, not a cleanup.
3. **Vector logo originals.** Session 2 flagged the supplied rasters as 720px, which will
   soften at large or print sizes.
4. **Better photography.** Session 2's own note: three of the six client interiors are
   cool-toned stock that contradicts the warm-daylight imagery rule, and none reads as
   Moroccan. Treat them as structural, not final.
5. **Arabic / RTL is undesigned.** The whole system is French-only today.
6. **The wizard has no route into the product.** Nothing in the website or mobile kit opens it,
   and there is no post-publish confirmation screen.
7. **Missing components**, per session 1's own note: Avatar, Accordion, Table. `Tabs` is
   currently doubling as the segmented control.
