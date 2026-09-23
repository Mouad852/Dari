import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The dynamic half of the app configuration; app.json stays the static half
 * (and is where `eas init` writes the project id).
 *
 * A production build is refused here, while its configuration is evaluated,
 * when a value it needs is missing or unsafe. EXPO_PUBLIC_* values are inlined
 * into the JavaScript bundle at build time and cannot be changed afterwards, so
 * a build that starts without them ships a binary that cannot work.
 *
 * "Production" is APP_VARIANT=production, which eas.json sets on the
 * production profile, or EAS_BUILD_PROFILE=production on the EAS builder. The
 * explicit variable is needed because EAS does not set EAS_BUILD_PROFILE when
 * `eas build` evaluates this file on the developer's machine.
 *
 * Every message names the variable, never its value.
 */

type Env = Record<string, string | undefined>;

const HTTPS_URL = /^https:\/\/[^/\s?#]+(\/[^\s?#]*)?$/;

export function isProductionBuild(env: Env): boolean {
  return env.APP_VARIANT === 'production' || env.EAS_BUILD_PROFILE === 'production';
}

export function releaseConfigErrors(env: Env): string[] {
  const errors: string[] = [];
  const value = (name: string) => env[name]?.trim() ?? '';

  const api = value('EXPO_PUBLIC_API_BASE_URL');
  if (!api) errors.push('EXPO_PUBLIC_API_BASE_URL is missing');
  else if (!HTTPS_URL.test(api)) errors.push('EXPO_PUBLIC_API_BASE_URL must be an https:// URL');
  else if (!api.replace(/\/+$/, '').endsWith('/api/v1')) errors.push('EXPO_PUBLIC_API_BASE_URL must end with /api/v1');

  for (const name of ['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID']) {
    if (!value(name)) errors.push(`${name} is missing`);
  }

  // The web app's origin: the in-app privacy and terms links open pages there.
  const site = value('EXPO_PUBLIC_SITE_URL');
  if (!site) errors.push('EXPO_PUBLIC_SITE_URL is missing');
  else if (!HTTPS_URL.test(site)) errors.push('EXPO_PUBLIC_SITE_URL must be an https:// URL');

  if (!value('EXPO_PUBLIC_RELEASE_VERSION')) errors.push('EXPO_PUBLIC_RELEASE_VERSION is missing');

  // Not EXPO_PUBLIC_: it belongs in the Android manifest, not in the bundle.
  if (!value('GOOGLE_MAPS_ANDROID_API_KEY')) errors.push('GOOGLE_MAPS_ANDROID_API_KEY is missing');

  return errors;
}

export function withReleaseConfig(config: ExpoConfig, env: Env): ExpoConfig {
  if (isProductionBuild(env)) {
    const errors = releaseConfigErrors(env);
    if (errors.length > 0) {
      throw new Error(`Production build configuration is incomplete:\n- ${errors.join('\n- ')}`);
    }
  }

  const mapsKey = env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  if (!mapsKey) return config;
  return {
    ...config,
    android: {
      ...config.android,
      config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } },
    },
  };
}

export default ({ config }: ConfigContext): ExpoConfig => withReleaseConfig(config as ExpoConfig, process.env);
