import { expect, test } from './fixtures';

/*
 * The public pages promise only what Dari does (audit P2-22). Rents are not
 * "charges comprises" (charges are optional per-listing fields), profiles are
 * not vetted (only the email is verified), messages reach the owner, not "les
 * colocataires", and there is no online rent collection.
 */
const FALSE_CLAIMS = /charges comprises|profils (vérifiés|contrôlés)|encaissez|les colocataires\.|Mises à jour aujourd/i;

for (const path of ['/', '/flatshare/rabat', '/listings?city=Rabat']) {
  test(`${path} makes no claim the product does not back`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(FALSE_CLAIMS);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description ?? '').not.toMatch(FALSE_CLAIMS);
  });
}
