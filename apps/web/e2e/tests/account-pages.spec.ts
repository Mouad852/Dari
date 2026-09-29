import { expect, test } from './fixtures';

/* The account pages state only what the product actually does. */

test('there is no payments page: the hub does not offer one and old links land on the hub', async ({ authenticatedPage: page }) => {
  await page.goto('/account');
  await expect(page.getByRole('link', { name: /Profil public/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Paiements/ })).toHaveCount(0);

  await page.goto('/account/payments');
  await expect(page).toHaveURL(/\/account$/);
});
