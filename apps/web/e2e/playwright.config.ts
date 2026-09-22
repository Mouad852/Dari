import { defineConfig, devices } from '@playwright/test';

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
      metadata: { mediaOrigin: safeCiEnv.NEXT_PUBLIC_MEDIA_ORIGINS, cdnOrigin: 'http://127.0.0.1:4110' },
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
