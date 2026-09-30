import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/*
 * A 400 names the fields it rejects (audit P1-4). Each form shows the message
 * on the field itself and lists every one, labelled, in its alert -- rather
 * than "Données invalides" and nothing else.
 */

function rejectWith(page: Page, url: string, method: string, fields: Record<string, string>) {
  return page.route(url, (route) => (route.request().method() === method
    ? route.fulfill({ status: 400, json: { code: 'VALIDATION_FAILED', message: 'Données invalides', fields } })
    : route.continue()));
}

test('the publish wizard shows a rejected field on its input and lists the others', async ({ authenticatedPage: page }) => {
  await rejectWith(page, '**/api/v1/listings', 'POST', {
    priceRent: 'Le loyer doit être supérieur à 0',
    title: '120 caractères maximum',
  });
  await page.goto('/publish');
  await page.getByLabel('Titre de l’annonce').fill('Chambre test E2E');
  await page.getByRole('combobox', { name: 'Quartier', exact: true }).fill('Agdal');
  await page.getByRole('button', { name: /saisir les coordonnées/i }).click();
  await page.getByLabel('Latitude').fill('33.9716');
  await page.getByLabel('Longitude').fill('-6.8498');
  await page.getByLabel('Description').fill('Une chambre calme pour une colocation respectueuse.');
  for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByLabel('Loyer mensuel').fill('3200');
  await page.getByLabel('Aménagement de la chambre').selectOption('PARTIALLY_FURNISHED');
  await page.getByLabel('Disponible à partir du').fill('2030-10-01');
  await page.getByRole('button', { name: 'Suivant' }).click();

  const alert = page.getByRole('alert').filter({ hasText: 'Données invalides' });
  await expect(alert).toContainText('Titre de l’annonce : 120 caractères maximum');
  await expect(alert).toContainText('Loyer mensuel : Le loyer doit être supérieur à 0');
  const rent = page.getByLabel('Loyer mensuel');
  await expect(rent).toHaveAttribute('aria-invalid', 'true');
  await expect(rent).toHaveAccessibleDescription('Le loyer doit être supérieur à 0');
});

test('the profile form shows each rejected field under it', async ({ authenticatedPage: page }) => {
  await rejectWith(page, '**/api/v1/users/me', 'PATCH', { bio: '600 caractères maximum' });
  await page.goto('/account/profile');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Données invalides' })).toContainText('Biographie : 600 caractères maximum');
  const bio = page.getByLabel('Biographie');
  await expect(bio).toHaveAttribute('aria-invalid', 'true');
  await expect(bio).toHaveAccessibleDescription('600 caractères maximum');
  await expect(page.getByLabel('Prénom')).not.toHaveAttribute('aria-invalid', 'true');
});

test('the report dialog shows a rejected detail on its field', async ({ authenticatedPage: page }) => {
  await rejectWith(page, '**/api/v1/reports', 'POST', { details: '1000 caractères maximum' });
  await page.goto('/listings/listing-1');
  await page.getByRole('button', { name: 'Signaler cette annonce' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio').first().check();
  await dialog.getByRole('button', { name: /envoyer le signalement/i }).click();

  await expect(dialog.getByRole('alert')).toContainText('Détails : 1000 caractères maximum');
  const details = dialog.getByLabel(/Détails/);
  await expect(details).toHaveAttribute('aria-invalid', 'true');
  await expect(details).toHaveAccessibleDescription('1000 caractères maximum');
});

test('text fields stop at the API limit instead of failing on save', async ({ authenticatedPage: page }) => {
  await page.goto('/publish');
  const description = page.getByLabel('Description');
  await description.fill('a'.repeat(2001));
  await expect(description).toHaveValue('a'.repeat(2000));
  const title = page.getByLabel('Titre de l’annonce');
  await title.fill('t'.repeat(121));
  await expect(title).toHaveValue('t'.repeat(120));
});

test('sign-up names fit the 60-character display name together', async ({ page }) => {
  await page.goto('/sign-up');
  const main = page.getByRole('main');
  await main.getByLabel('Prénom').fill('p'.repeat(40));
  await main.getByLabel('Nom', { exact: true }).fill('n'.repeat(40));
  await expect(main.getByLabel('Prénom')).toHaveValue('p'.repeat(30));
  await expect(main.getByLabel('Nom', { exact: true })).toHaveValue('n'.repeat(29));
});
