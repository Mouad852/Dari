import { expect, expectAccessible, test } from './fixtures';

test('signup provisions the profile through the API-owned boundary', async ({ authenticatedPage: page }) => {
  let profileCreated = false;
  await page.route('**/api/v1/users', async (route) => {
    if (route.request().method() === 'POST') profileCreated = true;
    await route.continue();
  });

  await page.goto('/sign-up');
  await page.getByLabel('Prénom').fill('Nadia');
  await page.getByRole('textbox', { name: 'Nom', exact: true }).fill('Test');
  await page.getByLabel('Ville (facultatif)').fill('Rabat');
  await page.getByLabel('E-mail').fill('nadia@example.invalid');
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: /créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/account$/);
  expect(profileCreated).toBeTruthy();
  await expectAccessible(page);
});

test('clearing profile fields sends empty strings, which the API reads as "clear"', async ({ authenticatedPage: page }) => {
  let patchBody: Record<string, unknown> | null = null;
  await page.route('**/api/v1/users/me', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    patchBody = route.request().postDataJSON() as Record<string, unknown>;
    const current = await (await route.fetch({ method: 'GET' })).json();
    await route.fulfill({ json: { ...current, firstName: null, city: null, bio: null } });
  });

  await page.goto('/account/profile');
  await page.getByLabel('Prénom').fill('');
  await page.getByRole('main').getByLabel('Ville').fill('');
  await page.getByLabel('Biographie').fill('');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByRole('status')).toContainText('Profil enregistré');
  // null would mean "unchanged" to the API and leave the old values public.
  expect(patchBody).toMatchObject({ firstName: '', city: '', bio: '' });
});

test('listing publication covers the wizard, photo upload, and moderation handoff', async ({ authenticatedPage: page }) => {
  // Every listing write the wizard makes, merged the way the API applies them.
  const written: Record<string, unknown> = {};
  page.on('request', (request) => {
    if (/\/api\/v1\/listings(\/listing-new)?$/.test(request.url()) && ['POST', 'PATCH'].includes(request.method())) {
      for (const [key, value] of Object.entries(request.postDataJSON() ?? {})) {
        if (value !== null) written[key] = value;
      }
    }
  });
  await page.goto('/publish');
  await page.getByLabel("Titre de l’annonce").fill('Chambre test E2E');
  await page.getByRole('combobox', { name: 'Quartier', exact: true }).fill('Agdal');
  await page.getByRole('button', { name: /saisir les coordonnées/i }).click();
  await page.getByLabel('Latitude').fill('33.9716');
  await page.getByLabel('Longitude').fill('-6.8498');
  await page.getByLabel('Description').fill('Une chambre calme pour une colocation respectueuse.');

  for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByLabel('Loyer mensuel').fill('3200');
  await page.getByLabel('Aménagement de la chambre').selectOption('PARTIALLY_FURNISHED');
  await page.getByLabel('Disponible à partir du').fill('2030-10-01');
  await page.getByLabel('Caution').fill('3 200');
  await page.getByLabel('Durée minimale').fill('6');
  await page.getByLabel('Wi-Fi').selectOption('INCLUDED');
  await page.getByLabel('Électricité').selectOption('NOT_INCLUDED');
  await page.getByLabel('Chambres dans le logement').fill('3');
  await page.getByLabel('Salles de bain').fill('1');
  await page.getByLabel('Colocataires actuels').fill('2');
  await page.getByLabel('Colocataires au maximum').fill('3');
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: 'Suivant' }).click();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: 'cover.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('e2e-image') });
  await expect(page.getByAltText('Photo 1 de l’annonce')).toBeVisible();
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: /publier l’annonce/i }).click();
  await expect(page.getByRole('status')).toContainText('envoyée pour validation');
  expect(written).toMatchObject({
    roomFurnishing: 'PARTIALLY_FURNISHED',
    availableFrom: '2030-10-01',
    priceDeposit: 3200,
    minStayMonths: 6,
    wifiIncluded: 'INCLUDED',
    electricityIncluded: 'NOT_INCLUDED',
    numBedrooms: 3,
    numBathrooms: 1,
    currentRoommatesCount: 2,
    maxRoommates: 3,
  });
  // Left at "Non précisé": never sent, so the server keeps NA.
  expect(written).not.toHaveProperty('waterIncluded');
  await expectAccessible(page);
});

test('favorites, messaging, reporting, moderation, and account deletion remain application-owned', async ({ authenticatedPage: page }) => {
  // Six routes, each compiled on first visit under `next dev`: a cold run
  // measured 29-33s against the default 30s budget, while warm runs take ~16s.
  test.slow();
  await page.goto('/listings?city=Rabat');
  await page.getByRole('button', { name: 'Enregistrer' }).first().click();
  await page.goto('/favorites');
  await expect(page.getByText('Chambre lumineuse à Agdal')).toBeVisible();

  await page.goto('/messages');
  await page.getByRole('link', { name: /amina/i }).click();
  await page.getByLabel('Écrire un message').fill('Bonjour, je suis intéressé.');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Bonjour, je suis intéressé.')).toBeVisible();

  await page.goto('/listings/listing-1');
  await page.getByRole('button', { name: /signaler/i }).click();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: /envoyer le signalement/i }).click();
  await expect(page.getByRole('heading', { name: /signalement reçu/i })).toBeVisible();

  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Réactiver' }).click();
  await expect(page.getByText('Actif')).toBeVisible();
  await expectAccessible(page);

  await page.goto('/account/profile');
  let deletionRequested = false;
  await page.route('**/api/v1/users/me', async (route) => {
    if (route.request().method() === 'DELETE') deletionRequested = true;
    await route.continue();
  });
  // The confirmation is the app's own Dialog now, so this is a real click and
  // real typing -- dispatchEvent('click') existed only to get past confirm().
  await page.getByRole('button', { name: /supprimer définitivement mon compte/i }).click();
  const confirmation = page.getByRole('dialog');
  await expect(confirmation).toBeVisible();
  await expectAccessible(page);

  // Escape cancels, and focus goes back to the button that opened it.
  await page.keyboard.press('Escape');
  await expect(confirmation).toBeHidden();
  await expect(page.getByRole('button', { name: /supprimer définitivement mon compte/i })).toBeFocused();
  expect(deletionRequested, 'cancelling deletes nothing').toBe(false);

  await page.getByRole('button', { name: /supprimer définitivement mon compte/i }).click();
  // Not armed until the word is typed exactly.
  await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toBeDisabled();
  await page.getByLabel('Tapez SUPPRIMER pour confirmer').fill('SUPPRIMER');
  await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
  await expect.poll(() => deletionRequested).toBe(true);
});
