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
  // The maps are IN this scan. `.exclude('.leaflet-container')` used to take
  // them out of every run, which is how two unnamed, focusable Leaflet
  // containers stayed invisible to it.
  const results = await new AxeBuilder({ page }).analyze();
  const report = results.violations
    .map((item) => [`${item.id}: ${item.help}`, ...item.nodes.map((node) => `  ${node.html}`)].join('\n'))
    .join('\n');
  expect(results.violations, report).toEqual([]);
}
