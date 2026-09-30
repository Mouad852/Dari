import { e2eAuth } from '../playwright.config';
import { expect, expectAccessible, test } from './fixtures';

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

test('a profile with photo, bio, city and verified email is complete without a phone', async ({ authenticatedPage: page }) => {
  // The mock user has all four and no phone, which nothing in the product can set.
  await page.goto('/account');
  await expect(page.getByRole('link', { name: /Profil public/ })).toBeVisible();
  await expect(page.getByText('Profil complet')).toHaveCount(0);
  await expect(page.getByText('Téléphone')).toHaveCount(0);
});

test('there is no payments page: the hub does not offer one and old links land on the hub', async ({ authenticatedPage: page }) => {
  await page.goto('/account');
  await expect(page.getByRole('link', { name: /Profil public/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Paiements/ })).toHaveCount(0);

  await page.goto('/account/payments');
  await expect(page).toHaveURL(/\/account$/);
});

test('the security page sends a password-reset email to the account address', async ({ authenticatedPage: page }) => {
  await page.goto('/account/security');
  const main = page.getByRole('main');
  await expect(main.getByText(e2eAuth.email).first()).toBeVisible();
  // No made-up protection level, and no pointer to a console members cannot open.
  await expect(main.getByText('Niveau élevé')).toHaveCount(0);
  await expect(main.getByText(/Firebase/)).toHaveCount(0);
  await expectAccessible(page);

  await main.getByRole('button', { name: 'Changer mon mot de passe' }).click();
  await expect(main.getByRole('status')).toContainText(`envoyé à ${e2eAuth.email}`);
  expect(await page.evaluate(() => window.__DARI_E2E_AUTH__?.passwordResetEmails)).toEqual([e2eAuth.email]);
});
