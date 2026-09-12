'use client';

import { useEffect, useRef } from 'react';

/**
 * Root error boundary.
 *
 * Renders the message plainly and never the underlying error — the server's
 * envelope carries user-facing French, and anything else is an internal detail.
 * No "Oups", no exclamation mark, no blame.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // A client-side transition (the default for an internal `next/link`) never
  // reloads the document, so the browser's own "new page, read from the top"
  // behaviour never fires here -- unlike a hard navigation straight to a
  // broken URL, where focus starts at the top of the document regardless.
  // Without this, a screen reader user mid-navigation gets the whole page
  // swapped out under them with no cue that anything happened.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main
      style={{
        maxWidth: '32rem',
        margin: '0 auto',
        padding: 'var(--space-12, 4rem) var(--space-5, 1.25rem)',
      }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-h1)',
          fontWeight: 700,
          color: 'var(--sable-900)',
          letterSpacing: '-0.02em',
        }}
      >
        Une erreur est survenue
      </h1>

      <p style={{ color: 'var(--sable-600)', marginTop: 'var(--space-3, 0.75rem)' }}>
        La page n’a pas pu être chargée.
      </p>

      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: 'var(--space-6, 1.5rem)',
          padding: '0.75rem 1.5rem',
          borderRadius: '999px',
          border: 'none',
          background: 'var(--brand)',
          color: 'var(--sable-0)',
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        Réessayer
      </button>

      {/* The digest is the only safe handle for support: it correlates with a
          server log line without exposing anything about the failure. */}
      {error.digest ? (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginTop: 'var(--space-6, 1.5rem)',
          }}
        >
          {error.digest}
        </p>
      ) : null}
    </main>
  );
}
