import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

/**
 * The server HTML and the first client render must match: React only reports
 * a mismatch in development, where it logs it and then patches the DOM, so
 * the dev server is where it can be caught. The skip link used to write the
 * `<main>` id from an effect, which ran before later parts of the page had
 * hydrated and made their server HTML disagree with React.
 */
function hydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat/i.test(message.text())) errors.push(message.text().slice(0, 300));
  });
  page.on('pageerror', (error) => {
    if (/hydrat/i.test(error.message)) errors.push(error.message.slice(0, 300));
  });
  return errors;
}

for (const route of ['/', '/listings', '/sign-in', '/legal/privacy']) {
  test(`${route} hydrates without a mismatch`, async ({ page }) => {
    const errors = hydrationErrors(page);
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#main-content')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test('the skip link moves keyboard focus to the main content', async ({ page }) => {
  await page.goto('/listings');
  const skipLink = page.getByRole('link', { name: 'Aller au contenu principal' });

  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('an authenticated page hydrates without a mismatch', async ({ authenticatedPage: page }) => {
  const errors = hydrationErrors(page);
  await page.goto('/account');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#main-content')).toHaveCount(1);
  expect(errors).toEqual([]);
});
