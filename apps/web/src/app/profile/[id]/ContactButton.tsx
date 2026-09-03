'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';

export function ContactButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContact = async () => {
    if (pending) return;
    const token = await getIdToken();
    if (!token) {
      router.push('/sign-in');
      return;
    }

    setPending(true);
    try {
      const conversation = await apiFetch<{ id: string }>('/conversations', {
        method: 'POST',
        token,
        body: { otherUserId: userId },
      });
      router.push(`/messages/${conversation.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Impossible de démarrer la conversation.');
      setPending(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      {error ? <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>{error}</p> : null}
      <button
        type="button"
        onClick={() => void handleContact()}
        disabled={pending}
        style={{
          border: 'none',
          background: 'var(--brand)',
          color: '#fff',
          borderRadius: 'var(--radius-pill)',
          padding: '0.95rem 1.2rem',
          font: 'var(--weight-semibold) var(--type-body) var(--font-ui)',
          cursor: pending ? 'default' : 'pointer',
          opacity: pending ? 0.7 : 1,
          boxShadow: 'var(--shadow-brand)',
        }}
      >
        {pending ? 'Un instant…' : 'Contacter'}
      </button>
    </div>
  );
}
