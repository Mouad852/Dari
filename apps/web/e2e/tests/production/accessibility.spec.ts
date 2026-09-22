import { test } from '@playwright/test';

import { expectAccessible } from '../fixtures';

/*
 * The same axe scan as the dev journeys, against `next build && next start`.
 * The two builds are not interchangeable here: the production one serves
 * prerendered HTML and the static CSP, and this project's pages are the
 * public ones (the test auth seam is compiled out of a production build).
 *
 * The maps are included — that is the point of this file existing.
 */
const PUBLIC_PAGES = ['/', '/sign-in', '/listings/listing-1', '/profile/other-user', '/flatshare/rabat'];

for (const path of PUBLIC_PAGES) {
  test(`${path} is accessible in a production build`, async ({ page }) => {
    await page.goto(path);
    await expectAccessible(page);
  });
}

test('the search page and its map are accessible in a production build', async ({ page }) => {
  await page.goto('/listings?city=Rabat');
  await page.getByRole('tab', { name: 'Carte' }).click();
  // The pins are the part axe used to be blind to.
  await page.locator('.leaflet-marker-icon').first().waitFor();
  await expectAccessible(page);
});
