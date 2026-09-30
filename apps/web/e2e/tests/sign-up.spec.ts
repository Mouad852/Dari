import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/* Sign-up after the account exists, and Firebase's refusals in plain French (audit P2-20). */

/** Sets test-only seam options on top of the fixture's signed-in auth state. */
async function withSeam(page: Page, options: { authError?: string; accountUnverified?: boolean }) {
  await page.addInitScript((extra) => {
    window.__DARI_E2E_AUTH__ = { ...window.__DARI_E2E_AUTH__!, ...extra };
  }, options);
}

async function fillAndSubmit(page: Page) {
  const main = page.getByRole('main');
  await main.getByLabel('Prénom').fill('Salma');
  await main.getByLabel('Nom', { exact: true }).fill('Bennani');
  await main.getByLabel('E-mail', { exact: true }).fill('salma@example.invalid');
  await main.getByLabel('Mot de passe', { exact: true }).fill('secret123');
  await main.getByRole('button', { name: 'Créer mon compte' }).click();
}

test('once the account waits for email confirmation, the sign-up form is gone', async ({ authenticatedPage: page }) => {
  await withSeam(page, { accountUnverified: true });
  await page.goto('/sign-up');
  await fillAndSubmit(page);

  const main = page.getByRole('main');
  await expect(main.getByRole('status')).toContainText('Confirmez votre adresse e-mail');
  await expect(main.getByRole('button', { name: 'Créer mon compte' })).toHaveCount(0);
  await expect(main.getByLabel('E-mail', { exact: true })).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'J’ai confirmé mon e-mail' })).toBeVisible();
});

for (const [code, message] of [
  ['auth/weak-password', 'Ce mot de passe est trop faible'],
  ['auth/too-many-requests', 'Trop de tentatives depuis cet appareil'],
  ['auth/invalid-email', 'Cette adresse e-mail n’est pas valide'],
] as const) {
  test(`Firebase's ${code} is explained, not "vérifiez vos informations"`, async ({ authenticatedPage: page }) => {
    await withSeam(page, { authError: code });
    await page.goto('/sign-up');
    await fillAndSubmit(page);

    const alert = page.getByRole('main').getByRole('alert');
    await expect(alert).toContainText(message);
    await expect(alert).not.toContainText('Vérifiez vos informations');
    await expect(page.getByRole('main').getByRole('button', { name: 'Créer mon compte' })).toBeVisible();
  });
}
