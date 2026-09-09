'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import type { PublicListingDetail } from '@/types/api';

import { ListingDetailContent } from './ListingDetailContent';

/**
 * The server-rendered page (`page.tsx`) fetches `GET /listings/{id}` with no
 * token at all -- there is no way for a Server Component to reach the
 * browser's Firebase session, and that's the right tradeoff for the common
 * case: a real visitor is anonymous, and an unauthenticated fetch keeps the
 * fast path fast and crawlable.
 *
 * But the API's `getPublicOrOwnerListingDetail` has an owner/admin bypass
 * specifically so a draft, pending, rejected or suspended listing stays
 * visible to the one person previewing it or the moderator reviewing it --
 * and that bypass can never fire through an unauthenticated fetch. Every
 * "Voir" link on `/account/listings` and every "Voir l'annonce" link in the
 * moderation queue pointed straight at the page that can't use it, so both
 * silently 404'd on exactly the listings they exist to preview: anything
 * that isn't PUBLISHED + AVAILABLE. Found 2026-09-09 by actually clicking
 * "Voir l'annonce" from the moderation queue during a live admin-action test,
 * not by reading the code.
 *
 * `page.tsx` only reaches this component when the anonymous fetch 404'd, so
 * this retries with the real Firebase token before accepting that as final.
 */
export function AuthenticatedPreview({ id }: { id: string }) {
  const [state, setState] = useState<'loading' | 'not-found' | PublicListingDetail>('loading');

  useEffect(() => {
    let isCurrent = true;

    void (async () => {
      const token = await getIdToken();
      if (!token) {
        if (isCurrent) setState('not-found');
        return;
      }
      try {
        const listing = await apiFetch<PublicListingDetail>(`/listings/${encodeURIComponent(id)}`, { token });
        if (isCurrent) setState(listing);
      } catch (cause) {
        if (isCurrent) setState('not-found');
        if (!(cause instanceof ApiError && cause.status === 404)) throw cause;
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [id]);

  if (state === 'loading') {
    return <main style={{ minHeight: '100vh' }} />;
  }

  if (state !== 'not-found') {
    return <ListingDetailContent listing={state} />;
  }

  // Same copy as app/not-found.tsx, for a visitor this component decides
  // (once the authenticated retry also fails) genuinely has no access.
  return (
    <main
      style={{
        maxWidth: '32rem',
        margin: '0 auto',
        padding: 'var(--space-12, 4rem) var(--space-5, 1.25rem)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-h1)',
          fontWeight: 700,
          color: 'var(--sable-900)',
          letterSpacing: '-0.02em',
        }}
      >
        Cette page n’existe plus
      </h1>

      <p style={{ color: 'var(--sable-600)', marginTop: 'var(--space-3, 0.75rem)' }}>
        L’annonce a peut-être été louée ou retirée.
      </p>

      <p style={{ marginTop: 'var(--space-6, 1.5rem)' }}>
        <Link href="/listings" style={{ color: 'var(--brand)', fontWeight: 600 }}>
          Voir les annonces disponibles
        </Link>
      </p>
    </main>
  );
}
