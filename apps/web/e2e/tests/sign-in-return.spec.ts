import { expect, expectAccessible, test } from './fixtures';

/*
 * A signed-out visitor is sent to sign in with the way back attached
 * (audit P2-18), and the wizard asks before any typing, not after.
 */

test('a signed-out visitor meets the sign-in step before the publish wizard', async ({ page }) => {
  await page.goto('/publish');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Publier une annonce' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/sign-in?next=%2Fpublish');
  await expect(main.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/sign-up');
  await expect(page.getByLabel('Titre de l’annonce')).toHaveCount(0);
  await expectAccessible(page);
});

test('"Se connecter" on a signed-out page carries the way back', async ({ page }) => {
  await page.goto('/favorites');
  await expect(page.getByRole('main').getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/sign-in?next=%2Ffavorites');
});

test('signing in returns to the page named in next', async ({ authenticatedPage: page }) => {
  await page.goto('/sign-in?next=%2Ffavorites');
  const main = page.getByRole('main');
  await main.getByLabel('E-mail', { exact: true }).fill('e2e.user@example.invalid');
  await main.getByLabel('Mot de passe', { exact: true }).fill('secret123');
  await main.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/favorites$/, { timeout: 15_000 });
});
