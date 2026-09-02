# Dari — Design System

Design system for **Dari**, a colocation / room-rental platform for Morocco (Rabat, Casablanca, Marrakech, Tangier). Tone: warm, trustworthy, modern — the clarity of a European rental app, dressed in a Moroccan palette of terracotta, sand and cream instead of cool fintech blues.

## Sources given

| Source | Status |
| --- | --- |
| Written brand brief (company description, palette direction, typography direction, mobile-first constraint) | **the only source** — pasted into chat, reproduced below |
| Codebase / repository | none provided |
| Figma file | none provided |
| Logo, photography, icon set, font binaries | none provided |
| Slide deck / template | none provided |

Brief verbatim: *"colocation/room-rental platform in Morocco (Rabat, Casablanca, Marrakech, Tangier). Tone: warm, trustworthy, modern — think Badi (room rental app) restyled with a Moroccan palette instead of cool European fintech tones. Primary palette: warm terracotta/sand as the accent color, off-white/cream background, deep charcoal for text (not pure black). Clean modern sans-serif typography, generous spacing, rounded corners on cards. Mobile-first."*

### Invented, and awaiting your confirmation
Because no product source existed, the following are **proposals, not recreations**:
- **The name "Dari"** (Moroccan Arabic *dar*, "house" → *dari*, "my home"). Swap it if the real brand name differs — it appears in `thumbnail.html`, `ui_kits/website/SiteChrome.jsx`, `guidelines/brand-wordmark.card.html`, `SKILL.md`.
- **Exact hex values, type scale, spacing and radii** — derived from the palette direction, not sampled from a design.
- **Fonts**: Plus Jakarta Sans (UI + display) and IBM Plex Mono (numerals/refs), both from Google Fonts, standing in for unsupplied binaries.
- **Icons**: Lucide via CDN.
- **No logo exists.** The brand is set in plain type wherever a mark would go. Nothing was drawn from memory.
- **Copy language is French**, the dominant interface language for Moroccan urban rental products. Arabic / RTL is not yet designed.
- **No photography.** Every image slot renders a warm `sable-200` placeholder labelled PHOTO.

---

## Content fundamentals

**Voice.** A well-informed local friend, not a marketplace. Warm but factual; never hype, never scarcity pressure.

**Person.** Address the user as *vous* (plural-polite; Moroccan urban standard for products). Dari speaks about itself in the third person or not at all — never *nous vous proposons*.
- Yes: *"Trouvez une colocation à Rabat."* / *"Complétez votre profil."*
- No: *"Nous avons sélectionné pour vous les meilleures offres !"*

**Casing.** Sentence case everywhere — buttons, tabs, headings, badges (*"Publier une annonce"*, not *"Publier Une Annonce"*). Uppercase only for the 11px eyebrow label with `--ls-caps` tracking. The wordmark is lowercase.

**Length.** Headings ≤ 7 words. Body sentences ≤ 20 words. One idea per paragraph. Secondary lines under a title are one clause, no full stop when under ~4 words.

**Numbers & money.** Prices are `3 200 MAD/mois` — thin space thousands separator, currency after the amount, period always stated. Ratings use a decimal comma: `4,8`. Dates in French long form (*1er septembre*). Listing references in mono: `DARI-RB-4821`.

**Trust language is earned, never decorative.** *"Annonce vérifiée"*, *"Identité vérifiée"*, *"charges comprises"*, *"caution protégée"* appear only where the platform actually guarantees them. Never *"100 % sûr"*.

**Buttons** are verb-first and specific: *Contacter*, *Publier une annonce*, *Voir 32 annonces*, *Réinitialiser*. Never *Cliquez ici*, *Soumettre*, *En savoir plus*.

**Empty states** name the action that fills them: *"Touchez le cœur sur une annonce pour la retrouver ici."*

**Errors** are plain and non-blaming: *"Email incomplet"*, *"Connexion perdue"* — no *"Oups !"*, no exclamation marks anywhere in the product.

**Emoji: never.** Not in UI, not in notifications, not in marketing copy. Meaning is carried by Lucide glyphs.

---

## Visual foundations

**Colour.** Terracotta `--clay-500 #C05F3C` is the single action colour; sand `--sand-400 #DDA046` is a highlight (ratings, illustration fills, eyebrows on dark) and never a button fill. Backgrounds are cream `--sable-50 #FBF7F2`, surfaces white, text charcoal `--sable-900 #241F1C` — no pure white page, no pure black text. Semantics are warm-shifted: atlas green `#35786A`, saffron `#C98A16`, rose clay `#B33A2B`. Majorelle blue `#3F5AA6` is informational only. **Maximum two background tones per screen** (cream + one of white / `--bg-page-alt` / a single terracotta band).

**Typography.** One family, Plus Jakarta Sans: 800 for display, 700 for H1–H2, 600 for H3/labels/buttons, 400 for body. Display tracking `-.02em`; body `0`. Mobile scale: 40/32/28/22/18 headings, 17/15/13/12/11 text. Line-height 1.55 body, 1.24 headings. IBM Plex Mono appears only for reference IDs.

**Spacing.** 4px-derived with a 6px half-step for chip padding. 20px mobile gutter, 48px desktop; 16px card padding (20px on desktop cards); 12px stack gap between cards; 32px mobile / 72px desktop section rhythm. Generous: white space is the luxury signal, not decoration.

**Corners.** 12px controls, 14px images, 18px cards, 24px sheets and large panels, 32px hero blocks, full pill for every button, chip, badge and avatar. Nothing in Dari is square-cornered.

**Cards.** White, 18px radius, 1px `--border-hairline #E9E1D6` border, `--shadow-sm`. Hover: `--shadow-md` + `translateY(-2px)` over 220ms. Photo-first cards run the image full-bleed to the card edge with `padding:0`.

**Shadows.** Warm brown-tinted (`rgba(58,42,32,…)`) — a neutral-grey shadow is off-brand. Five steps: xs hairline lift, sm resting cards, md hover, lg modals/hero search, `--shadow-sheet` upward for bottom sheets, `--shadow-brand` a terracotta glow under primary buttons. Inner shadows only inside toggle tracks and inset fields.

**Backgrounds.** Flat colour first. The one permitted gradient is the hero's vertical `--clay-50 → --bg-page` wash; the other is `--scrim-image`, a bottom-up charcoal scrim that makes white text legible on photography. No mesh gradients, no purple, no patterns behind text. Zellige / geometric ornament is deliberately **not** used as wallpaper — warmth comes from colour and light, not motif clip-art.

**Imagery.** Real interiors in warm late-afternoon daylight; people in situ, never stock-posed. No blue-cast, no black-and-white, no heavy grain, no duotone. 14px radius, 4:3 in feeds, 1:1 in compact rows, 260px tall on mobile detail. Missing images show `--sable-200` with a small uppercase PHOTO label — an honest placeholder, never a drawn illustration.

**Transparency & blur.** Only over photography or as a floating chrome layer: `--surface-glass` (white 72%) + `--blur-glass` (12px) for image-overlay controls, the sticky site header, the sticky mobile contact bar, and price/count pills on photos. Scrim `--surface-scrim` (charcoal 56%) behind modals. Never blur over flat cream.

**Motion.** 140ms colour/hover, 220ms cards and appearances, 320ms screen transitions, 420ms bottom sheets. `--ease-standard cubic-bezier(.2,.6,.24,1)` for interface, `--ease-out` for entrances. Fades and short upward slides (8–12px) only — **no bounce, no spring, no parallax, no scroll-jacking**. Sheets rise from the bottom edge; toasts rise 12px and fade.

**States.** Hover *darkens* (`--brand-hover`) and adds elevation; never opacity as a hover state. Press *darkens further and shrinks* to `scale(.975)` for 80ms. Focus is a 3px terracotta ring at 28% (`--focus-ring`), never a browser outline. Selected filter chips invert to **charcoal**, not terracotta, so selection never competes with the primary action. Disabled is `--sable-200` fill with muted text, no strikethrough.

**Borders.** One hairline weight (1px `--border-hairline`) does nearly all separation work; `--border-default` on inputs and secondary buttons; `--border-strong` rare. Dividers are hairline, full-bleed inside cards. No coloured left-border accent cards.

**Layout rules.** Mobile: fixed 56px top bar, fixed 64px tab bar, sticky glass action bar on detail screens; every tap target ≥ 44px. Desktop: sticky glass header (72px), 1200px container, 660px prose measure, sticky 300px filter rail. Content never touches the gutter; sections stack in a single column on mobile and 3–4 columns at 1024px+.

---

## Iconography

- **Lucide** (`lucide-static@0.441.0`, CDN) — flagged substitution: no icon set was supplied. Stroke-based, 2px stroke, round caps; the closest match to a warm, friendly, non-corporate mark.
- Rendered through the **`Icon`** component as a CSS mask filled with `currentColor`, so glyphs inherit text colour and never need re-export. `<Icon name="map-pin" size={16} />`.
- Sizes: **16** inline with 13px text, **20** default beside body text and in list rows, **22–24** in the tab bar and nav.
- Canonical vocabulary: `search`, `sliders-horizontal`, `map-pin`, `heart`, `star`, `shield-check`, `message-circle`, `user-round`, `users-round`, `bed-double`, `wifi`, `washing-machine`, `car`, `sun`, `utensils`, `key-round`, `calendar`, `wallet`, `sparkles`, `chevron-left/right/down`, `check`, `x`, `send`, `share-2`, `log-out`.
- **No emoji, no unicode dingbats, no PNG icons, no hand-drawn SVG.** If a needed concept has no Lucide glyph, use words.
- No brand illustration library exists yet; nothing was invented to fill the gap.

## Assets

`assets/` is intentionally empty apart from this note: **no logo, photography, illustration or icon binaries were provided.** The wordmark is type (`Wordmark` in `ui_kits/website/SiteChrome.jsx`, spec card `guidelines/brand-wordmark.card.html`). Send real files and they drop straight into the kits.

---

## Index

| Path | What |
| --- | --- |
| `styles.css` | Single entry point consumers link — `@import` list only |
| `tokens/` | `fonts.css` (webfonts) · `colors.css` · `typography.css` · `spacing.css` · `radius.css` · `elevation.css` · `motion.css` · `base.css` (resets, link colours, keyframes) |
| `guidelines/` | 17 specimen cards: colours (brand, sand, neutrals, semantic, surfaces), type (display, body, numerals), spacing (scale, layout, radii), brand (elevation, motion, states, imagery, glass, wordmark) |
| `components/` | Reusable primitives, grouped — see below |
| `ui_kits/mobile_app/` | Click-through phone app (feed → filters → listing → messages → profile) |
| `ui_kits/website/` | Desktop marketing site (homepage → results → contact dialog) |
| `thumbnail.html` | Homepage tile for this design system |
| `SKILL.md` | Agent-skill front matter for use outside this project |

### Components

**core/** — `Button`, `IconButton`, `Badge`, `Tag`, `Card`, `Icon`
**forms/** — `Input`, `Select`, `Checkbox`, `Radio`, `Switch`
**navigation/** — `Tabs` (underline + segmented)
**feedback/** — `Dialog` (modal + bottom sheet), `Toast`, `Tooltip`
**listings/** — `ListingCard` (vertical + horizontal)

Each directory holds `<Name>.jsx`, `<Name>.d.ts` (props contract), `<Name>.prompt.md` (usage) and one `@dsCard` HTML showing states.

#### Intentional additions
- **`Icon`** — wrapper around the Lucide set so glyph loading and colouring stay consistent; without it every consumer would hand-roll SVG.
- **`ListingCard`** — the product's hero object. A room-rental system without it would force every consumer to reinvent the most-used surface in the app.

No source defined a component inventory, so the standard set above was authored to the brief's needs. `Tabs` covers segmented controls; no separate Avatar, Accordion or Table exists yet — say the word if you need them.
