import { PROJECT_ID, URLS } from './stack.mjs';

/** The emulator's Identity Toolkit REST API; it accepts any API key. */
const IDENTITY = `${URLS.emulator}/identitytoolkit.googleapis.com/v1`;

async function call<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

/**
 * An emulator account whose email is already confirmed, and a fresh ID token
 * for it (the API refuses POST /users for an unverified email).
 */
export async function verifiedAccount(email: string, password = 'secret123'): Promise<{ uid: string; idToken: string }> {
  const created = await call<{ localId: string }>(`${IDENTITY}/accounts:signUp?key=any`, {
    email, password, returnSecureToken: true,
  });
  // "Bearer owner" is the emulator's admin credential.
  await call(`${IDENTITY}/projects/${PROJECT_ID}/accounts:update`, { localId: created.localId, emailVerified: true },
    { Authorization: 'Bearer owner' });
  const signedIn = await call<{ idToken: string }>(`${IDENTITY}/accounts:signInWithPassword?key=any`, {
    email, password, returnSecureToken: true,
  });
  return { uid: created.localId, idToken: signedIn.idToken };
}

/** Confirms the email of an account created through the web app. */
export async function confirmEmail(email: string): Promise<void> {
  // accounts:lookup by email (the emulator does not implement accounts:query).
  const found = await call<{ users?: { localId: string }[] }>(`${IDENTITY}/projects/${PROJECT_ID}/accounts:lookup`,
    { email: [email] }, { Authorization: 'Bearer owner' });
  const localId = found.users?.[0]?.localId;
  if (!localId) throw new Error(`no emulator account for ${email}`);
  await call(`${IDENTITY}/projects/${PROJECT_ID}/accounts:update`, { localId, emailVerified: true },
    { Authorization: 'Bearer owner' });
}
