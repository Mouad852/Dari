import { ShieldCheck } from 'lucide-react';

import { VERIFICATION_LABELS } from '@/lib/labels';
import type { VerificationTier } from '@/types/api';

/** How far a member is verified. Atlas blue when verified at all, neutral when not. */
export function VerificationBadge({ verification }: { verification: VerificationTier }) {
  const verified = verification !== 'NONE';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        borderRadius: 'var(--radius-pill)',
        background: verified ? 'var(--atlas-50)' : 'var(--sable-100)',
        color: verified ? 'var(--atlas-700)' : 'var(--text-muted)',
        padding: '0.38rem 0.68rem',
        font: 'var(--type-label)',
      }}
    >
      <ShieldCheck size={12} aria-hidden="true" />
      {VERIFICATION_LABELS[verification]}
    </span>
  );
}
