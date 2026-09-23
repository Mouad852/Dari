# Mobile client

- This is a standalone Expo SDK 57 / React Native 0.86 app; run commands from `apps/mobile/`.
- Use Expo Router file routes, `src/lib/api.ts`, `src/types/api.ts`, and `src/theme/tokens.ts`.
- Keep native headers disabled and preserve safe-area handling. Do not add ad-hoc API calls or copy stale design-system token values.
- Validate with `npm run typecheck && npm test` (jest-expo); use the pinned Expo v57 docs when SDK behavior is uncertain.
- Release configuration lives in `app.config.ts` (production build gate) and `eas.json`; values come from EAS environment variables, never committed files. See `docs/MOBILE_RELEASE.md`.
