'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { getIdToken, onAuthChange } from '@/lib/firebase';
import type { Me } from '@/types/api';

const AUTH_PAGES = ['/sign-in', '/sign-up', '/profile-recovery'];

/**
 * Says so when the signed-in account is suspended (audit P2-11).
 *
 * A suspended account can still sign in and read, but every write is refused
 * with 403 ACCOUNT_SUSPENDED. Without this, each form failed on its own with
 * "Ce compte est suspendu (lecture seule)" and nothing said so beforehand.
 * Rechecked on every navigation, so a suspension or its lifting shows up
 * without a reload. Silent on any failure: the pages report their own.
 */
export function AccountStatusBanner() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [suspended, setSuspended] = useState(false);

  useEffect(() => onAuthChange((user) => setSignedIn(Boolean(user))), []);

  // Sign-in, sign-up and profile recovery run the session themselves. A check
  // from here raced them: its /users/me for a deleted account ends the session
  // (apiFetch's 401 handling) while the sign-in form is still using it.
  const onAuthPage = AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

  useEffect(() => {
    if (!signedIn || onAuthPage) {
      setSuspended(false);
      return;
    }
    let isCurrent = true;
    void (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const me = await apiFetch<Me>('/users/me', { token });
        if (isCurrent) setSuspended(me.status === 'SUSPENDED');
      } catch {
        // No profile yet, offline, or signed out meanwhile: nothing to announce.
      }
    })();
    return () => {
      isCurrent = false;
    };
  }, [signedIn, pathname, onAuthPage]);

  if (!suspended) return null;
  return (
    <div
      role="status"
      style={{
        padding: 'var(--space-3) var(--gutter-mobile)',
        background: 'var(--warning-subtle)',
        borderBottom: '1px solid var(--warning-border)',
        color: 'var(--text-heading)',
        font: 'var(--type-body-sm)',
        textAlign: 'center',
      }}
    >
      <strong>Votre compte est suspendu par la modération.</strong> Vous pouvez consulter Dari, mais pas publier,
      modifier vos annonces ni envoyer de messages.
    </div>
  );
}
