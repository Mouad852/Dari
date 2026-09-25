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

export const PROFILE_FIELDS_REQUIRED = 'Renseignez au moins votre nom d’affichage.';
export const EMAIL_UNVERIFIED = 'Vérifiez votre adresse e-mail avant de créer votre profil';

/** The `POST /users` body, or null when the one required field is empty. */
export function profileBody(fields: ProfileFields): { displayName: string; firstName: string; city: string | null } | null {
  const displayName = fields.displayName.trim();
  if (!displayName) return null;
  return { displayName, firstName: fields.firstName.trim(), city: fields.city.trim() || null };
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
