import type { ExpoConfig } from 'expo/config';

import { isProductionBuild, releaseConfigErrors, withReleaseConfig } from '../app.config';

const BASE: ExpoConfig = { name: 'Dari', slug: 'dari', android: { package: 'ma.dari.app' } };

// Obviously fake values; the gate only checks their presence and shape.
const COMPLETE = {
  APP_VARIANT: 'production',
  EXPO_PUBLIC_API_BASE_URL: 'https://api.example.invalid/api/v1',
  EXPO_PUBLIC_FIREBASE_API_KEY: 'fake-firebase-key',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'fake.firebaseapp.example.invalid',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'fake-project',
  EXPO_PUBLIC_SITE_URL: 'https://www.example.invalid',
  EXPO_PUBLIC_RELEASE_VERSION: '1.0.0-test',
  GOOGLE_MAPS_ANDROID_API_KEY: 'fake-maps-key-value',
};

const REQUIRED = Object.keys(COMPLETE).filter((name) => name !== 'APP_VARIANT');

describe('production build gate', () => {
  it('treats APP_VARIANT or the EAS profile as production, and nothing else', () => {
    expect(isProductionBuild({ APP_VARIANT: 'production' })).toBe(true);
    expect(isProductionBuild({ EAS_BUILD_PROFILE: 'production' })).toBe(true);
    expect(isProductionBuild({ APP_VARIANT: 'preview' })).toBe(false);
    expect(isProductionBuild({})).toBe(false);
  });

  it('accepts a complete production configuration and puts the Maps key in the Android config', () => {
    expect(releaseConfigErrors(COMPLETE)).toEqual([]);
    const config = withReleaseConfig(BASE, COMPLETE);
    expect(config.android?.config?.googleMaps?.apiKey).toBe('fake-maps-key-value');
    expect(config.android?.package).toBe('ma.dari.app');
  });

  it.each(REQUIRED)('refuses a production build without %s, naming it', (name) => {
    const env = { ...COMPLETE, [name]: '' };
    expect(releaseConfigErrors(env)).toEqual([`${name} is missing`]);
    expect(() => withReleaseConfig(BASE, env)).toThrow(name);
  });

  it('refuses an API or site URL that is not https, without printing it', () => {
    const env = {
      ...COMPLETE,
      EXPO_PUBLIC_API_BASE_URL: 'http://10.0.0.5:8080/api/v1',
      EXPO_PUBLIC_SITE_URL: 'http://www.example.invalid',
    };
    expect(releaseConfigErrors(env)).toEqual([
      'EXPO_PUBLIC_API_BASE_URL must be an https:// URL',
      'EXPO_PUBLIC_SITE_URL must be an https:// URL',
    ]);
    let message = '';
    try { withReleaseConfig(BASE, env); } catch (error) { message = (error as Error).message; }
    expect(message).not.toContain('10.0.0.5');
    expect(message).not.toContain('fake-maps-key-value');
  });

  it('refuses an API URL that does not end with /api/v1', () => {
    expect(releaseConfigErrors({ ...COMPLETE, EXPO_PUBLIC_API_BASE_URL: 'https://api.example.invalid' }))
      .toEqual(['EXPO_PUBLIC_API_BASE_URL must end with /api/v1']);
  });

  it('lets a development build through with nothing set', () => {
    expect(withReleaseConfig(BASE, {})).toEqual(BASE);
  });
});
