import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const legalPlaceholders = {
  DARI_LEGAL_ENTITY_NAME: 'Dari E2E',
  DARI_LEGAL_ADDRESS: 'E2E only',
  DARI_LEGAL_REGISTRATION: 'E2E only',
  DARI_LEGAL_CONTACT: 'e2e@example.invalid',
  DARI_LEGAL_JURISDICTION: 'E2E only',
  DARI_LEGAL_COMPLAINT_AUTHORITY: 'E2E only',
  DARI_LEGAL_RETENTION: 'E2E only',
  DARI_LEGAL_PROCESSORS: 'E2E only',
  DARI_LEGAL_LAWFUL_BASES: 'E2E only',
  DARI_LEGAL_EFFECTIVE_DATE: '2026-09-20',
  DARI_LEGAL_VERSION: 'e2e',
};

const safeCiEnv = {
  API_BASE_URL: 'http://127.0.0.1:4110/api/v1',
  NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:4110/api/v1',
  NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3110',
  NEXT_PUBLIC_MEDIA_ORIGINS: 'http://127.0.0.1:4110',
  DARI_SSR_SHARED_SECRET: 'e2e-only-ssr-shared-secret-placeholder-value',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'e2e-public-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'e2e.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'e2e-project',
  NEXT_PUBLIC_E2E_TEST_MODE: 'true',
  ...legalPlaceholders,
};

/*
 * PRODUCTION-BUILD PROJECT — test-only setup, never deployment guidance.
 *
 * Runs `next build && next start` (NODE_ENV=production, NEXT_PUBLIC_E2E_TEST_MODE
 * unset) so the real production gate, the static CSP and prerendered/ISR HTML
 * are what the browser sees. The internal API, public API, media and CDN hosts
 * are deliberately DIFFERENT names, so a leak of the internal host is visible.
 *
 * - The gate requires HTTPS, so the mock API runs in HTTPS mode with a
 *   self-signed certificate generated at start-up (e2e/mock-api.mjs).
 * - `.invalid` names never resolve: the Next server maps *.example.invalid to
 *   loopback through a --require preload (e2e/resolve-example-invalid.cjs) and
 *   Chromium through --host-resolver-rules. Port 4443, because CI cannot bind 443.
 * - NODE_TLS_REJECT_UNAUTHORIZED=0 is scoped to the Next server's env only, and
 *   the browser context sets ignoreHTTPSErrors, to accept that certificate.
 * - The build goes to its own distDir so it can run beside `next dev`'s .next.
 */
const PRODUCTION_WEB = 'http://127.0.0.1:3111';
const PRODUCTION_MOCK_PORT = 4443;
const PRODUCTION_MEDIA = `https://media.example.invalid:${PRODUCTION_MOCK_PORT}`;
const PRODUCTION_CDN = `https://cdn.example.invalid:${PRODUCTION_MOCK_PORT}`;
// The mock API also plays the error-tracking ingest endpoint; the key is a placeholder.
const PRODUCTION_ERRORS = `https://errors.example.invalid:${PRODUCTION_MOCK_PORT}`;
const PRODUCTION_SENTRY_DSN = `https://e2epublickeyplaceholder@errors.example.invalid:${PRODUCTION_MOCK_PORT}/42`;
export const PRODUCTION_SSR_KEY = 'e2e-production-ssr-shared-secret-placeholder';
const resolverPreload = path.join(__dirname, 'resolve-example-invalid.cjs').replace(/\\/g, '/');

const productionEnv = {
  API_BASE_URL: `https://api.internal.example.invalid:${PRODUCTION_MOCK_PORT}/api/v1`,
  NEXT_PUBLIC_API_BASE_URL: `https://api.public.example.invalid:${PRODUCTION_MOCK_PORT}/api/v1`,
  NEXT_PUBLIC_SITE_URL: 'https://www.example.invalid',
  NEXT_PUBLIC_MEDIA_ORIGINS: `${PRODUCTION_MEDIA},${PRODUCTION_CDN}`,
  DARI_SSR_SHARED_SECRET: PRODUCTION_SSR_KEY,
  NEXT_PUBLIC_FIREBASE_API_KEY: 'e2e-public-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'e2e.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'e2e-project',
  NEXT_PUBLIC_RELEASE_VERSION: 'e2e',
  NEXT_PUBLIC_SENTRY_DSN: PRODUCTION_SENTRY_DSN,
  NEXT_PUBLIC_E2E_TEST_MODE: '',
  ...legalPlaceholders,
  DARI_WEB_DIST_DIR: '.next-production-e2e',
  NODE_TLS_REJECT_UNAUTHORIZED: '0',
  NODE_OPTIONS: `--require ${resolverPreload}`,
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3110',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'dev',
      testIgnore: ['production/**'],
      metadata: { mediaOrigin: safeCiEnv.NEXT_PUBLIC_MEDIA_ORIGINS, cdnOrigin: 'http://127.0.0.1:4110' },
    },
    {
      name: 'production',
      testMatch: ['production/**/*.spec.ts', 'media-origin.spec.ts', 'json-ld.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: PRODUCTION_WEB,
        ignoreHTTPSErrors: true,
        launchOptions: { args: ['--host-resolver-rules=MAP *.example.invalid 127.0.0.1'] },
      },
      metadata: {
        mediaOrigin: PRODUCTION_MEDIA,
        cdnOrigin: PRODUCTION_CDN,
        mockUrl: `https://127.0.0.1:${PRODUCTION_MOCK_PORT}`,
        publicApiOrigin: `https://api.public.example.invalid:${PRODUCTION_MOCK_PORT}`,
        errorsOrigin: PRODUCTION_ERRORS,
      },
    },
  ],
  webServer: [
    {
      command: 'node e2e/mock-api.mjs',
      cwd: '..',
      url: 'http://127.0.0.1:4110/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3110',
      cwd: '..',
      url: 'http://127.0.0.1:3110',
      reuseExistingServer: false,
      timeout: 120_000,
      env: safeCiEnv,
    },
    {
      command: 'node e2e/mock-api.mjs',
      cwd: '..',
      url: `https://127.0.0.1:${PRODUCTION_MOCK_PORT}/health`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        E2E_MOCK_HTTPS: 'true',
        E2E_MOCK_PORT: String(PRODUCTION_MOCK_PORT),
        E2E_MOCK_CDN_ORIGIN: PRODUCTION_CDN,
        E2E_EXPECTED_SSR_KEY: PRODUCTION_SSR_KEY,
      },
    },
    {
      command: 'npm run build && npm run start -- --hostname 127.0.0.1 --port 3111',
      cwd: '..',
      url: PRODUCTION_WEB,
      reuseExistingServer: false,
      timeout: 600_000,
      env: productionEnv,
    },
  ],
  outputDir: 'test-results',
});

export const e2eAuth = {
  uid: 'e2e-user-1',
  email: 'e2e.user@example.invalid',
  displayName: 'Utilisateur E2E',
  emailVerified: true,
  token: 'e2e-firebase-token',
};
