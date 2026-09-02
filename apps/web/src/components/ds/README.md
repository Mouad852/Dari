# Design-system components (port target)

Ported from `design-system/components/**/*.jsx` in phase 03. Empty until then —
this file records the rules so the port does not drift.

## What goes here

```
Button.tsx  IconButton.tsx  Badge.tsx  Tag.tsx  Card.tsx  Icon.tsx
Input.tsx   Select.tsx      Checkbox.tsx  Radio.tsx  Switch.tsx
Tabs.tsx    Dialog.tsx      Toast.tsx     Tooltip.tsx
ListingCard.tsx
```

## Porting rules

**Port from the `.jsx` sources, not from `_ds_bundle.js`.** The bundle is a
prototype runtime that resolves components off a global; it must never ship.
Note the hazard recorded in `docs/ANALYSIS.md`: the bundle is *newer* than the
sources, so take its one genuine improvement deliberately — `Icon` inlining SVG
children rather than using a CSS mask — and nothing else from it by accident.

**Keep every `var(--token)` reference exactly as written.** Do not improve
spacing or color while porting. Those decisions are already made, and a port
that drifts is worse than no port, because the drift is invisible until two
screens sit side by side.

**Add types from the existing `.d.ts` files** rather than inferring them.

**`Icon` needs rework for SSR.** The v1 source fetches each glyph from a CDN at
runtime: a network request per icon, and nothing rendered server-side. Bundle the
~30 glyphs listed in `design-system/readme.md` from `lucide-react`, keyed by the
same `name` strings so markup copied from the UI kits works unchanged. An unknown
name renders nothing — words, never a broken glyph.

## Non-negotiables from the design system

- Terracotta `--clay-500` is the only action color. Sand `--sand-400` highlights
  and is never a button fill.
- Cards are 18px radius; buttons are pills.
- Shadows are warm and brown-tinted, `rgba(58,42,32,…)`, never neutral gray.
- No emoji. No exclamation marks. Sentence case. Headings of seven words or
  fewer. Buttons verb-first and specific.
