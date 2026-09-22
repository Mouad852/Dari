'use client';

import { useEffect, useRef } from 'react';

import { reportError } from '@/lib/reporting';

/**
 * The boundary above the root layout.
 *
 * `error.tsx` sits *inside* layout.tsx, so it can never catch a throw from the
 * layout itself, from SiteNav/SiteFooter, or from a chunk of the layout that
 * fails to load after a deploy — those took the whole document down with no
 * recovery path. This one replaces the document, which is why it renders its
 * own <html> and <body>.
 *
 * Every value here is a literal, deliberately: app.css is imported by the root
 * layout, and this component renders when that layout is exactly what failed,
 * so no design token is guaranteed to resolve. The literals are the token
 * values (--sable-50/-900/-600, --brand = --clay-500), kept in step by hand.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    reportError(error, { digest: error.digest, kind: 'global' });
    headingRef.current?.focus();
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          background: '#FBF7F2',
          color: '#241F1C',
          fontFamily: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
        }}
      >
        <main style={{ maxWidth: '32rem', margin: '0 auto', padding: '4rem 1.25rem' }}>
          <h1
            ref={headingRef}
            tabIndex={-1}
            style={{ margin: 0, fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em' }}
          >
            Une erreur est survenue
          </h1>

          <p style={{ color: '#6E635C', marginTop: '0.75rem' }}>
            La page n’a pas pu être chargée.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              borderRadius: '999px',
              border: 'none',
              background: '#B55535',
              color: '#FFFFFF',
              fontWeight: 600,
              fontFamily: 'inherit',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>

          {/* The digest correlates with a server log line and says nothing else. */}
          {error.digest ? (
            <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', color: '#6E635C', marginTop: '1.5rem' }}>
              {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
