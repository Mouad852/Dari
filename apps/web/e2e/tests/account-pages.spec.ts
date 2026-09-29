import { expect, test } from './fixtures';

/* The account pages state only what the product actually does. */

test('the notifications page lists only emails the product sends', async ({ authenticatedPage: page }) => {
  await page.goto('/account/notifications');
  const main = page.getByRole('main');
  await expect(main.getByText('Mises à jour de vos annonces')).toBeVisible();
  await expect(main.getByText(/signalement est bien reçu/)).toBeVisible();
  // No email is sent for new messages yet, and a reporter never learns the outcome.
  await expect(main.getByText('Nouveaux messages', { exact: true })).toHaveCount(0);
  await expect(main.getByText(/ne sont pas encore envoyés par e-mail/)).toBeVisible();
  await expect(main.getByText(/est traité/)).toHaveCount(0);
});

test('there is no payments page: the hub does not offer one and old links land on the hub', async ({ authenticatedPage: page }) => {
  await page.goto('/account');
  await expect(page.getByRole('link', { name: /Profil public/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Paiements/ })).toHaveCount(0);

  await page.goto('/account/payments');
  await expect(page).toHaveURL(/\/account$/);
});
