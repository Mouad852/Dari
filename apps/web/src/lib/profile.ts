'use client';

import type { User as FirebaseUser } from 'firebase/auth';

import { apiFetch, ApiError } from './api';
import { ErrorCode } from './errors';
import { getFirebaseUser, getIdToken, reloadFirebaseUser, sendVerificationEmailForUser } from './firebase';

export type PendingProfile = {
  displayName: string;
  firstName: string;
  city: string;
};

const STORAGE_KEY = 'dari.pending-profile.v1';

export function savePendingProfile(profile: PendingProfile): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function loadPendingProfile(): PendingProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PendingProfile> | null;
    if (!value || typeof value.displayName !== 'string' || typeof value.firstName !== 'string' || typeof value.city !== 'string') return null;
    return { displayName: value.displayName, firstName: value.firstName, city: value.city };
  } catch {
    return null;
  }
}

export function clearPendingProfile(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
}

export async function sendVerificationEmail(user?: FirebaseUser | null): Promise<void> {
  const current = user ?? await getFirebaseUser();
  if (!current) throw new Error('NO_FIREBASE_USER');
  await sendVerificationEmailForUser(current);
}

export async function refreshVerifiedIdentity(): Promise<FirebaseUser> {
  const user = await getFirebaseUser();
  if (!user) throw new Error('NO_FIREBASE_USER');
  await reloadFirebaseUser(user);
  if (!user.email?.trim()) throw new ApiError(400, ErrorCode.IDENTITY_EMAIL_REQUIRED, 'Une adresse e-mail Firebase est requise');
  if (!user.emailVerified) throw new ApiError(403, ErrorCode.IDENTITY_EMAIL_UNVERIFIED, 'Vérifiez votre adresse e-mail avant de créer votre profil');
  return user;
}

export async function ensureProfile(profile?: PendingProfile) {
  const user = await getFirebaseUser();
  if (!user) throw new Error('NO_FIREBASE_USER');
  if (!user.email?.trim()) throw new ApiError(400, ErrorCode.IDENTITY_EMAIL_REQUIRED, 'Une adresse e-mail Firebase est requise');
  if (!user.emailVerified) throw new ApiError(403, ErrorCode.IDENTITY_EMAIL_UNVERIFIED, 'Vérifiez votre adresse e-mail avant de créer votre profil');
  const pending = profile ?? loadPendingProfile();
  if (!pending?.displayName.trim()) throw new Error('PROFILE_FIELDS_REQUIRED');
  const token = await getIdToken(true);
  if (!token) throw new Error('NO_FIREBASE_TOKEN');
  const created = await apiFetch('/users', {
    method: 'POST',
    token,
    body: {
      displayName: pending.displayName.trim(),
      firstName: pending.firstName.trim(),
      city: pending.city.trim() || null,
    },
  });
  clearPendingProfile();
  return created;
}
