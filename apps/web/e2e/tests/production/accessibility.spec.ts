import { expect, test, type Page } from '@playwright/test';

import { expectAccessible } from '../fixtures';

/*
 * `goto` can resolve while a production page is still streaming: the body
 * after its loading skeleton, and the metadata Next streams in after the
 * page resolves. Scanned then, axe reported a missing <h1> and a missing
 * <title> on pages that have both (seen intermittently on cold runs).
 */
async function waitForStreamedDocument(page: Page) {
  await expect(page.locator('h1').first()).toBeAttached();
  await expect(page).toHaveTitle(/\S/);
}

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
    await waitForStreamedDocument(page);
    await expectAccessible(page);
  });
}

test('the search page and its map are accessible in a production build', async ({ page }) => {
  await page.goto('/listings?city=Rabat');
  await page.getByRole('tab', { name: 'Carte' }).click();
  // The pins are the part axe used to be blind to.
  await page.locator('.leaflet-marker-icon').first().waitFor();
  await waitForStreamedDocument(page);
  await expectAccessible(page);
});
