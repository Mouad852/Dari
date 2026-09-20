---
name: mobile-development
description: Develop the standalone Dari Expo/React Native client, including Expo Router screens, API calls, auth, and token-based styling.
---

Use this skill for work under `apps/mobile/`.

- This is a separate Expo SDK 57 / React Native 0.86 project, not a workspace package. Run commands from `apps/mobile/` and keep its lockfile/package manifest independent.
- Use Expo Router file-based routes, keep native headers disabled as established, and preserve safe-area handling.
- Use `src/lib/api.ts` as the API boundary and `src/types/api.ts` for hand-maintained wire types. Do not add ad-hoc `fetch` calls or silently diverging response shapes.
- Port visual values through `src/theme/tokens.ts`, which follows the shipping web tokens; do not copy the stale `design-system/tokens/` values into mobile.
- Validate with `npm run typecheck`. Use `npm run start` for the Expo dev server; consult the pinned Expo v57 documentation when an SDK behavior is uncertain.

The mobile client is still in progress; avoid assuming every web flow or native test harness exists.
