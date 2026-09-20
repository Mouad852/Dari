---
name: web-development
description: Build or debug Dari web routes, components, API integration, SEO metadata, and responsive styling in the Next.js App Router app.
---

Use this skill for work under `apps/web/`.

- Prefer Server Components for route data and metadata; add `'use client'` only for interaction, browser APIs, or client auth/state.
- Route all API calls through `src/lib/api.ts`; use `src/lib/config.ts`, `src/lib/errors.ts`, `src/lib/format.ts`, and `src/lib/labels.ts` instead of recreating contracts, messages, or formatting locally.
- Keep API enum values and code English while rendering reviewed French labels. Keep public DTOs distinct from owner/admin DTOs so private fields cannot leak.
- Treat `src/styles/tokens/` as a copied snapshot of `design-system/tokens/`. Use `npm run tokens:sync` deliberately and `npm run tokens:check` to detect drift; put app-specific responsive overrides in `src/styles/app.css`.
- Validate focused changes with `npm run typecheck` and, for token changes, `npm run tokens:check`. Run `npm run build` for route, metadata, environment, or Next config changes; use `npm run lint` when lint rules are relevant.
- Keep media URLs API-origin aware and preserve the API's error envelope rather than inventing client-side replacements.

Read `ARCHITECTURE.md`, `docs/NAMING.md`, and `src/components/ds/README.md` when the change touches design-system or copy boundaries.
