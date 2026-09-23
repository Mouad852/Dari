/**
 * Firebase Authentication, on-device.
 *
 * Hand-ported from apps/web/src/lib/firebase.ts -- same contract (sign-up
 * and sign-in happen against Firebase directly, never the Dari API, which
 * has no such endpoints). The one real difference is persistence: the web
 * SDK's `getAuth` persists to the browser's IndexedDB automatically: RN has
 * no IndexedDB, so the session has to be told explicitly where to live, via
 * `initializeAuth` + `getReactNativePersistence(AsyncStorage)` -- the setup
 * Expo's own docs point to for Firebase JS SDK auth in an Expo Go-compatible
 * app (github.com/expo/fyi/blob/main/firebase-js-auth-setup.md). Using
 * `@react-native-firebase` instead would have gotten native persistence for
 * free, but it needs a custom dev client and cannot run in Expo Go -- too
 * costly a trade this early, while Expo Go's fast iteration matters more
 * than that native integration.
 *
 * `Platform.OS === 'web'` branches to plain `getAuth` (browser persistence,
 * via IndexedDB): this product only ships iOS and Android, but the web
 * target stays enabled as this environment's dev convenience (no
 * simulator/device attached), and `getReactNativePersistence` -- found
 * live, not guessed -- throws at runtime under react-native-web, since
 * Metro correctly resolves `@firebase/auth` to its actual browser build
 * there, which has no AsyncStorage-backed persistence to offer.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
// Imports come from `@firebase/auth` directly, not the `firebase/auth`
// convenience wrapper the web app uses: the wrapper's own package.json
// `exports` map has no "react-native" condition (it always points at the
// plain browser/ESM build), so `getReactNativePersistence` doesn't exist on
// its types at all, even though the underlying `@firebase/auth` package --
// what `firebase/auth` re-exports from -- has a real RN-specific entry
// point (`dist/rn/index.rn.d.ts`) with everything this file needs,
// correctly resolved through tsconfig's `customConditions: ["react-native"]`
// (from `expo/tsconfig.base`) once imported at this level instead.
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  type Auth,
  type User as FirebaseUser,
} from '@firebase/auth';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
};

let authInstance: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    const app: FirebaseApp = getApps().length ? getApps()[0]! : initializeApp(config);
    authInstance =
      Platform.OS === 'web'
        ? getAuth(app)
        : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  }
  return authInstance;
}

/**
 * Always ask the SDK for the token rather than caching one.
 *
 * Same reasoning as the web copy: ID tokens expire hourly and the SDK
 * refreshes them transparently, and `authStateReady()` is the important
 * line -- a persisted session restores from AsyncStorage asynchronously, so
 * reading `currentUser` synchronously on mount can return null for a user
 * who is perfectly well signed in.
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  return user ? user.getIdToken(forceRefresh) : null;
}

export function signOut(): Promise<void> {
  return firebaseSignOut(getFirebaseAuth());
}

export function sendPasswordReset(email: string): Promise<void> {
  return sendPasswordResetEmail(getFirebaseAuth(), email);
}

/** Live auth-state updates -- see the same export on the web app for why this exists. */
export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}
