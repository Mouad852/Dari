'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { FULL_SCREEN_ROUTES } from '@/lib/fullScreenRoutes';

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
