import { spawnSync } from 'node:child_process';

import { expect, test, type Page } from '@playwright/test';

import { confirmEmail, verifiedAccount } from './emulator';
import { DB_CONTAINER, URLS } from './stack.mjs';

/*
 * The launch journey across the real stack (task 6.2b): an owner signs up and
 * publishes through the web app, a moderator approves, a seeker finds the
 * listing in search and messages the owner. Every step goes through the real
 * API, database and Firebase (emulator), so a contract drift between web and
 * API fails here even when the mock-based suite is green.
 */

const run = Date.now();
const OWNER = { email: `owner-${run}@example.invalid`, password: 'secret123' };
const TITLE = `Chambre full-stack ${run}`;

async function api<T>(method: string, path: string, token: string, body?: unknown): Promise<{ status: number; body: T }> {
  const response = await fetch(`${URLS.api}/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

/** A verified emulator account with a Dari profile; returns its ID token. */
async function member(email: string, displayName: string): Promise<string> {
  const { idToken } = await verifiedAccount(email);
  const created = await api('POST', '/users', idToken, { displayName, firstName: displayName.split(' ')[0], city: 'Rabat' });
  expect(created.status).toBe(201);
  return idToken;
}

/** Admins are promoted in the database; there is no endpoint for it. */
function promoteToAdmin(email: string) {
  const result = spawnSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', 'dari', '-d', 'dari', '-c',
    `UPDATE users SET role = 'ADMIN' WHERE email = '${email}'`], { encoding: 'utf8' });
  expect(result.stdout, result.stderr).toContain('UPDATE 1');
}

/** A real, decodable 800x600 JPEG selected in the wizard's file input (the API refuses < 200 px). */
async function pickPhoto(page: Page) {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#c96';
    context.fillRect(0, 0, 800, 600);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/jpeg', 0.9));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'chambre.jpg', { type: 'image/jpeg' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/**
 * `next dev` compiles each route on its first visit, and a click before React
 * hydrates is a native form submit that reloads an empty form. Wait for the
 * page to settle before using it.
 */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test('sign up, publish, approve, find in search and message the owner', async ({ page, browser }) => {
  test.slow();

  // 1. The owner signs up through the web app; the emulator holds the confirmation email.
  await open(page, '/sign-up');
  const signUp = page.getByRole('main');
  await signUp.getByLabel('Prénom').fill('Salma');
  await signUp.getByLabel('Nom', { exact: true }).fill('Owner');
  await signUp.getByLabel('E-mail', { exact: true }).fill(OWNER.email);
  await signUp.getByLabel('Mot de passe', { exact: true }).fill(OWNER.password);
  await signUp.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(signUp.getByRole('status')).toContainText('Confirmez votre adresse e-mail');
  await confirmEmail(OWNER.email);
  await signUp.getByRole('button', { name: 'J’ai confirmé mon e-mail' }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });

  // 2. The owner publishes a listing through the wizard.
  await open(page, '/publish');
  await page.getByLabel('Titre de l’annonce').fill(TITLE);
  await page.getByRole('combobox', { name: 'Quartier', exact: true }).fill('Agdal');
  await page.getByRole('button', { name: /saisir les coordonnées/i }).click();
  await page.getByLabel('Latitude').fill('33.9716');
  await page.getByLabel('Longitude').fill('-6.8498');
  await page.getByLabel('Description').fill('Une chambre calme pour une colocation respectueuse.');
  for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByLabel('Loyer mensuel').fill('3200');
  await page.getByLabel('Aménagement de la chambre').selectOption('PARTIALLY_FURNISHED');
  await page.getByLabel('Disponible à partir du').fill('2030-10-01');
  for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Suivant' }).click();
  // Each Suivant saves the draft to the real API first; wait for the photo step itself.
  await expect(page.getByText('Ajouter des photos')).toBeVisible({ timeout: 30_000 });
  await pickPhoto(page);
  await expect(page.getByAltText('Photo 1 de l’annonce')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.getByRole('button', { name: /publier l’annonce/i }).click();
  await expect(page.getByRole('status').filter({ hasText: 'envoyée pour validation' })).toBeVisible({ timeout: 30_000 });

  // 3. A moderator approves it.
  const adminEmail = `admin-${run}@example.invalid`;
  const adminToken = await member(adminEmail, 'Modération Dari');
  promoteToAdmin(adminEmail);
  const queue = await api<{ id: string; title: string }[]>('GET', '/admin/listings', adminToken);
  expect(queue.status).toBe(200);
  const listing = queue.body.find((item) => item.title === TITLE);
  expect(listing, 'the new listing waits in the moderation queue').toBeTruthy();
  expect((await api('POST', `/admin/listings/${listing!.id}/approve`, adminToken)).status).toBe(200);

  // 4. A seeker signs in, finds it in search and opens it.
  const seekerEmail = `seeker-${run}@example.invalid`;
  const seekerToken = await member(seekerEmail, 'Nadia Seeker');
  const seeker = await (await browser.newContext()).newPage();
  await open(seeker, '/sign-in');
  const signIn = seeker.getByRole('main');
  await signIn.getByLabel('E-mail', { exact: true }).fill(seekerEmail);
  await signIn.getByLabel('Mot de passe', { exact: true }).fill('secret123');
  await signIn.getByRole('button', { name: 'Se connecter' }).click();
  await expect(seeker).toHaveURL(/\/account$/, { timeout: 30_000 });

  await open(seeker, '/listings?city=Rabat');
  await seeker.getByRole('link', { name: new RegExp(TITLE) }).first().click();
  await expect(seeker.getByRole('heading', { level: 1, name: TITLE })).toBeVisible({ timeout: 30_000 });

  // 5. …and messages the owner.
  await seeker.getByRole('button', { name: 'Contacter' }).click();
  await expect(seeker).toHaveURL(/\/messages\/[0-9a-f-]+$/, { timeout: 30_000 });
  await seeker.getByLabel('Écrire un message').fill('Bonjour, la chambre est-elle disponible ?');
  await seeker.getByRole('button', { name: 'Envoyer' }).click();
  const thread = seeker.getByRole('log', { name: 'Messages de la conversation' });
  await expect(thread.getByText('Bonjour, la chambre est-elle disponible ?')).toBeVisible();

  const conversationId = seeker.url().split('/').pop()!;
  const stored = await api<{ items: { body: string }[] }>('GET', `/conversations/${conversationId}/messages`, seekerToken);
  expect(stored.body.items.map((message) => message.body)).toContain('Bonjour, la chambre est-elle disponible ?');
});
