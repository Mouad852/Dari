/**
 * Finishing a Dari profile for a signed-in Firebase account that has none.
 *
 * Ported from apps/web/src/lib/profile.ts. The API refuses `POST /users` until
 * the Firebase email is verified (403 IDENTITY_EMAIL_UNVERIFIED), so a fresh
 * account always goes through the profile-recovery screen: the verification
 * email is sent at sign-up, and the profile is created once the person has
 * opened it.
 */

import { reload, sendEmailVerification, type User } from '@firebase/auth';

import { apiFetch, ApiError } from './api';
import { getIdToken } from './firebase';

export type ProfileFields = { displayName: string; firstName: string; city: string };

export const PROFILE_FIELDS_REQUIRED = 'Le nom d’affichage doit contenir entre 2 et 60 caractères.';
export const EMAIL_UNVERIFIED = 'Vérifiez votre adresse e-mail avant de créer votre profil';

/** The `POST /users` body, or null when the display name is outside 2–60 characters. */
export function profileBody(fields: ProfileFields): { displayName: string; firstName: string; city: string | null } | null {
  const displayName = fields.displayName.trim();
  if (displayName.length < 2 || displayName.length > 60) return null;
  return { displayName, firstName: fields.firstName.trim(), city: fields.city.trim() || null };
}

/**
 * Only a definite PROFILE_NOT_FOUND sends the person to profile recovery;
 * other failures let the app open so each screen can report its own error.
 */
export async function hasProfile(): Promise<boolean> {
  try {
    await apiFetch('/users/me', { token: (await getIdToken()) ?? undefined });
    return true;
  } catch (cause) {
    return !(cause instanceof ApiError && cause.isMissingProfile);
  }
}

export function sendVerificationEmail(user: User): Promise<void> {
  return sendEmailVerification(user);
}

/**
 * Re-reads the account from Firebase (the person may have just verified in a
 * browser), then creates the profile with a fresh token, which is what
 * carries the new `email_verified` claim to the API.
 */
export async function completeProfile(user: User, fields: ProfileFields): Promise<void> {
  const body = profileBody(fields);
  if (!body) throw new Error(PROFILE_FIELDS_REQUIRED);
  await reload(user);
  if (!user.emailVerified) throw new ApiError(403, 'IDENTITY_EMAIL_UNVERIFIED', EMAIL_UNVERIFIED);
  const token = await getIdToken(true);
  if (!token) throw new Error('Firebase did not return an ID token');
  await apiFetch('/users', { method: 'POST', token, body });
}
