import { defineConfig, devices } from '@playwright/test';

import { URLS } from './full-stack/stack.mjs';

/**
 * The full-stack specs (e2e/full-stack), against the real API and the Firebase
 * Auth emulator. No webServer here: e2e/full-stack/run.mjs starts the stack in
 * order, runs this config, and tears it down (`npm run e2e:full-stack`).
 */
export default defineConfig({
  testDir: './full-stack',
  outputDir: './test-results/full-stack',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: 'list',
  use: {
    baseURL: URLS.web,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
});
