'use client';

import { MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';

/**
 * Starts a conversation about this listing.
 *
 * Its own island rather than part of the page, so the listing content around it
 * stays server-rendered. The error is local on purpose: a transient failure to
 * open a conversation should not blank a page a visitor is reading.
 */
export function ContactOwnerButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [contacting, setContacting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  /** See profile/[id]/ContactButton.tsx for why this exists: `disabled={contacting}` blurs the button to `<body>` on a failed attempt, and nothing gave focus back. */
  const shouldRefocusRef = useRef(false);
  useEffect(() => {
    if (!contacting && shouldRefocusRef.current) {
      shouldRefocusRef.current = false;
      buttonRef.current?.focus();
    }
  }, [contacting]);

  const contactOwner = async () => {
    shouldRefocusRef.current = true;
    setContacting(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) {
        router.push('/sign-in');
        return;
      }
      const conversation = await apiFetch<{ id: string }>('/conversations', {
        method: 'POST',
        token,
        body: { listingId },
      });
      router.push(`/messages/${conversation.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible de démarrer la conversation.');
      setContacting(false);
    }
  };

  return (
    <>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => void contactOwner()}
        disabled={contacting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '0.85rem 1.2rem',
          border: 0,
          borderRadius: 'var(--radius-md)',
          background: 'var(--brand)',
          color: '#fff',
          font: 'var(--type-label)',
          cursor: contacting ? 'wait' : 'pointer',
        }}
      >
        <MessageCircle size={17} aria-hidden="true" /> {contacting ? 'Ouverture…' : 'Contacter'}
      </button>
    </>
  );
}
