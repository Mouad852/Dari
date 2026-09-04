'use client';

/**
 * Firebase Authentication, client-side only.
 *
 * Signup and login happen here, against Firebase, and never against the Dari
 * API — which has no such endpoints and should not grow any. The API's entire
 * involvement is verifying the ID token this module produces.
 */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signOut as firebaseSignOut, type Auth } from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
};

let authInstance: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(config);
    authInstance = getAuth(app);
  }
  return authInstance;
}

/**
 * Always ask the SDK for the token rather than caching one.
 *
 * Firebase ID tokens expire after an hour and the SDK refreshes them
 * transparently. A token stashed in module state or localStorage goes stale and
 * produces intermittent 401s that are miserable to reproduce.
 *
 * `authStateReady()` is the important line. Firebase restores a persisted
 * session from IndexedDB *asynchronously*, and `currentUser` is null until that
 * lands — so reading it synchronously on mount returned null for a user who was
 * perfectly well signed in. Every authenticated page in this app asks for a
 * token in a mount effect, which meant that on a fresh load or a hard refresh
 * they all rendered their signed-out state: the inbox said it could not load
 * your conversations, the publish wizard failed to resume a draft it had just
 * written, and /account, /favorites and the admin console did the same.
 *
 * It looked like a config problem for as long as the config was actually
 * broken, which is why it survived — it only became visible once a real account
 * could sign in and reload a page. The promise resolves immediately once the
 * first restore has completed, so this costs nothing after the first call.
 */
export async function getIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
}

export function signOut(): Promise<void> {
  return firebaseSignOut(getFirebaseAuth());
}
