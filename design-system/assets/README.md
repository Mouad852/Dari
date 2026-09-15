# Assets — INCOMPLETE, see docs/ANALYSIS.md

This folder is still empty; it was never the recovery path in the end. See
`design-system/Dari-Logos/` instead — as of 2026-09-14 that folder holds six AI-generated
concept exports (a mark of two overlapping house outlines in the brand terracotta, light/dark
variants, an app-icon mockup, and a wordmark lockup), user-confirmed as the mark to use. The
transparent 500×500 terracotta export is already copied into `apps/web/public/logo-mark.png`
and wired into `SiteNav.tsx`'s `Logo` component (word + mark on wide screens, mark only once
the screen narrows) — see TODO.md's Priority 1 logo entry for the full story.

**Still missing:**
- **Vector logo originals** — no `.svg`/`.ai`/`.fig` source exists anywhere in the repo, only
  the raster PNG/JPEG exports above.
- **A real favicon / `apple-touch-icon` / `og:image`** — the app-icon mockup JPEG in
  `Dari-Logos/` is a plausible source once cropped/exported at the right sizes, but this hasn't
  been done yet.
- **Interior/marketing photography** — fully open; nothing has replaced the original session's
  lost photos. The homepage isn't currently blocked on this (listing photos are real user
  uploads and already work), but it is a launch blocker for mobile app store screenshots per
  `plans/11-mobile-react-native.md`'s risks section.

Until real photography exists, image slots fall back to the `--sable-200` placeholder labelled
PHOTO.

**Logo usage rules recorded in session 2** (see `../readme.v2-notes.md`): two joined rooflines
plus a lowercase wordmark; terracotta, cream and charcoal colourways; clear space equals one
roof height; full lockup down to 120px wide, symbol alone below that.
