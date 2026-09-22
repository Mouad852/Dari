import { publicOrigins } from './src/lib/public-origins.mjs';

function validateProductionConfiguration() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'NEXT_PUBLIC_API_BASE_URL',
    'API_BASE_URL',
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_MEDIA_ORIGINS',
    // Tags every error report; without it a production build reported as "development".
    'NEXT_PUBLIC_RELEASE_VERSION',
    // Server-only (never NEXT_PUBLIC_): identifies server renders to the API's
    // rate limiter. Same value as the API's DARI_SSR_SHARED_SECRET.
    'DARI_SSR_SHARED_SECRET',
    'DARI_LEGAL_ENTITY_NAME',
    'DARI_LEGAL_ADDRESS',
    'DARI_LEGAL_REGISTRATION',
    'DARI_LEGAL_CONTACT',
    'DARI_LEGAL_JURISDICTION',
    'DARI_LEGAL_COMPLAINT_AUTHORITY',
    'DARI_LEGAL_RETENTION',
    'DARI_LEGAL_PROCESSORS',
    'DARI_LEGAL_LAWFUL_BASES',
    'DARI_LEGAL_EFFECTIVE_DATE',
    'DARI_LEGAL_VERSION',
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Configuration de production manquante : ${missing.join(', ')}`);
  if (process.env.DARI_SSR_SHARED_SECRET.trim().length < 32) {
    throw new Error('Configuration de production invalide : DARI_SSR_SHARED_SECRET (32 caractères minimum)');
  }

  for (const name of ['NEXT_PUBLIC_API_BASE_URL', 'API_BASE_URL', 'NEXT_PUBLIC_SITE_URL']) {
    let parsed;
    try { parsed = new URL(process.env[name]); } catch { throw new Error(`URL de production invalide : ${name}`); }
    if (parsed.protocol !== 'https:') throw new Error(`URL de production non HTTPS : ${name}`);
    if (name !== 'NEXT_PUBLIC_SITE_URL' && !parsed.pathname.endsWith('/api/v1')) {
      throw new Error(`URL de production invalide : ${name}`);
    }
  }
  for (const origin of process.env.NEXT_PUBLIC_MEDIA_ORIGINS.split(',')) {
    let parsed;
    try { parsed = new URL(origin.trim()); } catch { throw new Error('Origine média publique invalide'); }
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/') throw new Error('Origine média publique invalide');
  }
}

validateProductionConfiguration();

/**
 * One static policy for every response, prerendered or dynamic.
 *
 * A per-request nonce cannot work here: ISR/static HTML is served from cache
 * and cannot carry a fresh nonce, so with 'strict-dynamic' the browser blocked
 * every Next bootstrap script on those routes and they never hydrated
 * (reproduced in Chromium, docs/PHASE1_CSP_REPRODUCTION.md).
 *
 * 'unsafe-inline' in script-src is required, not a shortcut: every App Router
 * page carries its flight data in inline <script>self.__next_f.push(...)
 * elements that differ per page and per ISR revalidation, so they can be
 * allowed neither by a static hash nor by a nonce on cached HTML. Scripts are
 * still restricted to this origin (no third-party host), the only raw-HTML sink
 * (listing JSON-LD) escapes "<", and object-src/base-uri/form-action/
 * frame-ancestors stay locked. A stricter script-src means rendering every
 * route per request with a nonce, i.e. giving up ISR.
 *
 * img-src/connect-src come from publicOrigins(), the same source
 * resolveMediaUrl uses, so they cannot drift from rendered URLs. The optional
 * error-tracking origin comes from the same call as the DSN reporting.ts sends
 * to; without NEXT_PUBLIC_SENTRY_DSN nothing is added.
 */
function contentSecurityPolicy() {
  const { api, media, errorReporting } = publicOrigins();
  const firebaseOrigin = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}`
    : 'https://*.firebaseapp.com';
  // `next dev` needs eval for its tooling; only the e2e dev server gets it.
  const developmentE2e = process.env.NEXT_PUBLIC_E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';

  return [
    "default-src 'self'",
    developmentE2e ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
    // next/font emits inline <style>; fonts are self-hosted, so no font host.
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    ["img-src 'self' data: blob:", ...media, 'https://*.tile.openstreetmap.org'].join(' '),
    "font-src 'self'",
    ["connect-src 'self'", api, firebaseOrigin, 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://www.googleapis.com', ...(errorReporting ? [errorReporting.origin] : [])].join(' '),
    ["frame-src 'self'", firebaseOrigin].join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Test-only override: the production-build e2e project builds into its own
  // directory so it can run beside the `next dev` project's .next.
  distDir: process.env.DARI_WEB_DIST_DIR || '.next',

  // Pin the trace root to this app. Without it Next walks up looking for a
  // lockfile, finds a stray one in the user's home directory, and treats that
  // as the workspace root.
  outputFileTracingRoot: import.meta.dirname,

  // Photo hosts must be allowlisted for next/image. Phase 05's storage choice
  // resurfaces here; keep this list in step with it.
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000' }, // MinIO, local dev
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
          // No preload: submitting the domain to browser preload lists is a
          // separate, hard-to-reverse decision for the domain owner.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Listing pages carry approximate locations. Keep them out of embeds.
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
