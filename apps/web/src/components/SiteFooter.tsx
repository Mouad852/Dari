'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Routes that bound their own layout to exactly the viewport height instead
 * of scrolling as a normal document — a conversation thread's sticky header,
 * internally-scrolling message list, and composer pinned at the bottom.
 * This footer appearing after them added a sliver of page-level scroll that
 * could nudge that whole layout upward, working against the point of
 * pinning the composer in the first place. Grep `height: '100vh'` under
 * `app/` before adding a route here — every other page uses `minHeight`,
 * where the footer at the bottom of a normal scroll is exactly right.
 */
const FULL_SCREEN_ROUTES = [/^\/messages\/[^/]+$/];

export function SiteFooter() {
  const pathname = usePathname();
  if (FULL_SCREEN_ROUTES.some((pattern) => pattern.test(pathname))) return null;

  return (
    <footer style={{ borderTop: '1px solid var(--border-hairline)', padding: 'var(--space-5) var(--gutter-mobile)', color: 'var(--text-muted)', font: 'var(--type-caption)' }}>
      <nav aria-label="Informations légales" style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <Link href="/legal/terms">Conditions d’utilisation</Link>
        <Link href="/legal/privacy">Confidentialité</Link>
        <Link href="/legal/location-data">Données de localisation</Link>
      </nav>
    </footer>
  );
}
