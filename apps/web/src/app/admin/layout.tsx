'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import type { Me } from '@/types/api';

/**
 * The real gate is server-side (`hasRole('ADMIN')` on every /api/v1/admin/**
 * route, per SecurityConfig) — every fetch under this tree fails safely on its
 * own even if this component were skipped entirely. This layout exists purely
 * for the experience: redirect a non-admin before they see a page full of 403s,
 * rather than after.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'allowed'>('checking');

  useEffect(() => {
    let isCurrent = true;

    async function check() {
      const token = await getIdToken();
      if (!token) {
        router.replace('/sign-in');
        return;
      }

      try {
        const me = await apiFetch<Me>('/users/me', { token });
        if (!isCurrent) return;
        if (me.role !== 'ADMIN') {
          router.replace('/');
          return;
        }
        setStatus('allowed');
      } catch (cause) {
        if (!isCurrent) return;
        router.replace(cause instanceof ApiError && cause.isMissingProfile ? '/sign-up' : '/sign-in');
      }
    }

    void check();
    return () => {
      isCurrent = false;
    };
  }, [router]);

  if (status === 'checking') {
    return (
      <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-muted)' }}>
        Vérification des accès…
      </main>
    );
  }

  return <>{children}</>;
}
