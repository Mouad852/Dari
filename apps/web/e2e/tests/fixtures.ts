import { expect, test as base, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { e2eAuth } from '../playwright.config';

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page, request }, use) => {
    await request.post('http://127.0.0.1:4110/__reset');
    await page.addInitScript((auth) => {
      window.__DARI_E2E_AUTH__ = auth;
    }, e2eAuth);
    await use(page);
  },
});

export { expect };

export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .exclude('.leaflet-container')
    .analyze();
  expect(results.violations, results.violations.map((item) => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
}
