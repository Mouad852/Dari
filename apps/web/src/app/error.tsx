'use client';

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
          fontSize: 'var(--text-2xl, 1.75rem)',
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
            color: 'var(--sable-400)',
            marginTop: 'var(--space-6, 1.5rem)',
          }}
        >
          {error.digest}
        </p>
      ) : null}
    </main>
  );
}
