'use client';

/**
 * Firebase Authentication, client-side only.
 *
 * Signup and login happen here, against Firebase, and never against the Dari
 * API — which has no such endpoints and should not grow any. The API's entire
 * involvement is verifying the ID token this module produces.
 */

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type Auth,
  type User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';
import { getWebConfig } from './config';

const config = getWebConfig().firebase;

let authInstance: Auth | undefined;

type E2eAuthState = {
  uid: string;
  email: string;
  displayName?: string;
  emailVerified?: boolean;
  token: string;
  /** What a forced refresh hands back, so the 401 replay path is reachable in tests. */
  refreshedToken?: string;
  /** How many forced refreshes happened; a test asserts concurrent 401s share one. */
  refreshCount?: number;
};

declare global {
  interface Window {
    /** Test-only auth seam installed by Playwright before the app loads. */
    __DARI_E2E_AUTH__?: E2eAuthState;
  }
}

function e2eAuthState(): E2eAuthState | null {
  if (process.env.NEXT_PUBLIC_E2E_TEST_MODE !== 'true' || process.env.NODE_ENV === 'production') return null;
  if (typeof window === 'undefined') return null;
  return window.__DARI_E2E_AUTH__ ?? null;
}

function e2eUser(): FirebaseUser | null {
  const state = e2eAuthState();
  if (!state) return null;
  return {
    uid: state.uid,
    email: state.email,
    displayName: state.displayName ?? null,
    emailVerified: state.emailVerified ?? true,
    getIdToken: async () => state.token,
    reload: async () => undefined,
  } as FirebaseUser;
}

function e2eCredential(email: string, password: string): UserCredential | null {
  if (!e2eAuthState()) return null;
  if (password.length < 6) throw new Error('auth/password-does-not-meet-requirements');
  const state: E2eAuthState = {
    uid: 'e2e-user-1',
    email,
    displayName: email.split('@')[0],
    emailVerified: true,
    token: 'e2e-firebase-token',
  };
  window.__DARI_E2E_AUTH__ = state;
  return { user: e2eUser()! } as UserCredential;
}

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
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const state = e2eAuthState();
  if (state) {
    // Firebase answers a forced refresh with a *different* token, and apiFetch
    // only replays when it gets one, so the seam has to model that too.
    if (forceRefresh) {
      const refreshed: E2eAuthState = {
        ...state,
        token: state.refreshedToken ?? state.token,
        refreshCount: (state.refreshCount ?? 0) + 1,
      };
      window.__DARI_E2E_AUTH__ = refreshed;
      return refreshed.token;
    }
    return state.token;
  }
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  return user ? user.getIdToken(forceRefresh) : null;
}

export async function getFirebaseUser(): Promise<FirebaseUser | null> {
  const testUser = e2eUser();
  if (testUser) return testUser;
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  return auth.currentUser;
}

export function signOut(): Promise<void> {
  if (e2eAuthState()) {
    delete window.__DARI_E2E_AUTH__;
    return Promise.resolve();
  }
  return firebaseSignOut(getFirebaseAuth());
}

/**
 * Live auth-state updates, for anything that needs to react to a sign-in or
 * sign-out that happens without a page reload.
 *
 * Sign-up, sign-in and sign-out all navigate with `router.push`, a
 * client-side transition -- so a component that only checks `getIdToken()`
 * once on mount (the persistent root-layout `SiteNav`, before this existed)
 * goes stale the instant any of those three fire: it keeps showing
 * "Se connecter" to a user who just signed in, and its unread-message-badge
 * poll never starts until a hard reload. `onAuthStateChanged` fires
 * immediately with the current state and again on every subsequent change,
 * so callers stay correct without polling for it themselves.
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production') {
    callback(e2eUser());
    return () => undefined;
  }
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export function sendPasswordReset(email: string): Promise<void> {
  if (e2eAuthState()) return Promise.resolve();
  return sendPasswordResetEmail(getFirebaseAuth(), email);
}

/** Firebase actions with a browser-only E2E seam; production always uses the SDK. */
export function createFirebaseAccount(email: string, password: string): Promise<UserCredential> {
  const credential = e2eCredential(email, password);
  return credential ? Promise.resolve(credential) : createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export function signInFirebase(email: string, password: string): Promise<UserCredential> {
  const credential = e2eCredential(email, password);
  return credential ? Promise.resolve(credential) : signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export function sendVerificationEmailForUser(user: FirebaseUser): Promise<void> {
  if (e2eAuthState()) return Promise.resolve();
  return sendEmailVerification(user);
}

export function reloadFirebaseUser(user: FirebaseUser): Promise<void> {
  if (e2eAuthState()) return Promise.resolve();
  return user.reload();
}
