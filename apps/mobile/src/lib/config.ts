/**
 * Runtime configuration, from the EXPO_PUBLIC_* values inlined into the bundle.
 *
 * Every read is a static `process.env.EXPO_PUBLIC_…` member access: that is the
 * only form Expo inlines when it builds the bundle. The earlier dynamic
 * `process.env[name]` lookup survived into the production bundle as a runtime
 * lookup, which Expo documents as unsupported.
 *
 * Release builds have no fallback API URL. The development default is the one
 * .env.example documents, and it only reaches the host machine from the iOS
 * simulator or the web target; a device needs the host's LAN IP in .env.
 */

const DEVELOPMENT_API_BASE_URL = 'http://localhost:8080/api/v1';

export const API_BASE_URL: string | null =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || (__DEV__ ? DEVELOPMENT_API_BASE_URL : null);

/**
 * The web app's origin, where the privacy notice and terms live. A production
 * build cannot be made without it (app.config.ts); in development the links
 * are simply hidden when it is unset.
 */
export const SITE_URL: string | null = process.env.EXPO_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') || null;

/**
 * The version of the terms and privacy notice the web serves, its
 * DARI_LEGAL_VERSION (owner decision P1-15): sent as the version accepted
 * when the profile is created. Required for a production build
 * (app.config.ts); development and preview builds record "dev".
 */
export const LEGAL_VERSION: string = process.env.EXPO_PUBLIC_LEGAL_VERSION?.trim() || 'dev';

export function configErrors(): string[] {
  const required: Record<string, string | null | undefined> = {
    EXPO_PUBLIC_API_BASE_URL: API_BASE_URL,
    EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  };
  return Object.entries(required)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => `Configuration mobile manquante : ${name}`);
}
