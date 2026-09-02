# Assets — INCOMPLETE, see docs/ANALYSIS.md

This folder is empty, but **it should not be.**

Session 2 received the client's real logo (6 JPEGs, cleaned into transparent PNGs in three
colourways) and 6 interior photographs, and wired them into the components. Only the compiled
runtime was exported from that session, so the image binaries did not survive.

The compiled bundle still references these paths, which currently 404:

- `assets/logo-lockup-terracotta.png`
- `assets/photos/detail-header.jpg`
- `assets/photos/thread-thumb.jpg`

Until they are restored, image slots fall back to the `--sable-200` placeholder labelled PHOTO.

**Logo usage rules recorded in session 2** (see `../readme.v2-notes.md`): two joined rooflines
plus a lowercase wordmark; terracotta, cream and charcoal colourways; clear space equals one
roof height; full lockup down to 120px wide, symbol alone below that.

Still missing beyond the recovery: **vector logo originals** — the supplied rasters were 720px
and will soften at large or print sizes.
