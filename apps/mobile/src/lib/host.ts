/**
 * The words on a listing's "Proposé par" card, worded as on the web
 * (lib/labels.ts VERIFICATION_LABELS and the profile page's "Membre depuis").
 */

import type { ListingHost, VerificationTier } from '@/types/api';

const VERIFICATION_LABEL: Record<VerificationTier, string> = {
  NONE: 'Non vérifié',
  EMAIL: 'Email vérifié',
  EMAIL_PHONE: 'Email et téléphone vérifiés',
};

export function verificationLabel(tier: VerificationTier): string {
  return VERIFICATION_LABEL[tier] ?? VERIFICATION_LABEL.NONE;
}

/** "Membre depuis septembre 2026". */
export function memberSinceLabel(host: Pick<ListingHost, 'memberSince'>): string {
  return `Membre depuis ${new Date(host.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
}
