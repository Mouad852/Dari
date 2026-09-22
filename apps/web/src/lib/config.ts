import { publicOrigins } from './public-origins.mjs';

export type WebConfig = {
  apiBaseUrl: string;
  siteUrl: string;
  mediaOrigins: string[];
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
  };
  releaseVersion: string;
};

const isProduction = process.env.NODE_ENV === 'production';

function required(name: string, value: string | undefined): string {
  if (value && value.trim()) return value.trim();
  if (isProduction) throw new Error(`Configuration web manquante : ${name}`);
  return '';
}

function parseOrigin(name: string, value: string, allowPath: boolean): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Configuration web invalide : ${name}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`Configuration web invalide : ${name}`);
  }
  if (!allowPath && parsed.pathname !== '/') {
    throw new Error(`Configuration web invalide : ${name}`);
  }
  if (isProduction && parsed.protocol !== 'https:') {
    throw new Error(`Configuration web ${name} doit utiliser HTTPS en production`);
  }
  return parsed.toString().replace(/\/$/, '');
}

function parseApiUrl(name: string, value: string): { baseUrl: string } {
  const parsed = parseOrigin(name, value, true);
  if (!new URL(parsed).pathname.endsWith('/api/v1')) {
    throw new Error(`Configuration web invalide : ${name} doit finir par /api/v1`);
  }
  return { baseUrl: parsed.replace(/\/$/, '') };
}

export function getWebConfig(): WebConfig {
  // Validates the public API URL's /api/v1 path in the browser and on the server.
  parseApiUrl(
    'NEXT_PUBLIC_API_BASE_URL',
    required('NEXT_PUBLIC_API_BASE_URL', process.env.NEXT_PUBLIC_API_BASE_URL) || 'http://localhost:8080/api/v1',
  );
  const api = parseApiUrl(
    typeof window === 'undefined' ? 'API_BASE_URL' : 'NEXT_PUBLIC_API_BASE_URL',
    required(
      typeof window === 'undefined' ? 'API_BASE_URL' : 'NEXT_PUBLIC_API_BASE_URL',
      typeof window === 'undefined' ? process.env.API_BASE_URL : process.env.NEXT_PUBLIC_API_BASE_URL,
    ) || 'http://localhost:8080/api/v1',
  );
  const siteUrl = parseOrigin(
    'NEXT_PUBLIC_SITE_URL',
    required('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL) || 'http://localhost:3000',
    false,
  );

  const firebaseApiKey = required('NEXT_PUBLIC_FIREBASE_API_KEY', process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const firebaseAuthDomain = required('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
  const firebaseProjectId = required('NEXT_PUBLIC_FIREBASE_PROJECT_ID', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  if (isProduction && (!firebaseApiKey || !firebaseAuthDomain || !firebaseProjectId)) {
    throw new Error('Configuration web Firebase incomplète');
  }
  if (firebaseAuthDomain && /[\s/:]/.test(firebaseAuthDomain)) {
    throw new Error('Configuration web invalide : NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  }

  return {
    apiBaseUrl: api.baseUrl,
    siteUrl,
    // Media is always a public browser URL. In particular, it must never fall
    // back to API_BASE_URL, which may name an internal service on SSR hosts.
    // The CSP's img-src is built from the same call (next.config.mjs).
    mediaOrigins: publicOrigins().media,
    firebase: { apiKey: firebaseApiKey, authDomain: firebaseAuthDomain, projectId: firebaseProjectId },
    releaseVersion: process.env.NEXT_PUBLIC_RELEASE_VERSION?.trim() || 'development',
  };
}

let primaryMediaOrigin: string | undefined;

/**
 * Converts a public API media reference to a browser-safe source URL.
 *
 * S3/CloudFront responses are already absolute. Local storage returns a
 * root-relative path, which is served from the first public media origin (or
 * the public API origin when no dedicated media origin is configured).
 */
export function resolveMediaUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  primaryMediaOrigin ??= getWebConfig().mediaOrigins[0];
  // Collapsing leading slashes keeps a protocol-relative value (//host/x) on
  // the media origin instead of letting it name another host.
  return new URL(`/${value.replace(/^\/+/, '')}`, `${primaryMediaOrigin}/`).toString();
}
