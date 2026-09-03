/**
 * Scaffold marker for a route that exists but is not built yet.
 *
 * <p>The counterpart to the API's 501: the URL structure is a real decision
 * worth reviewing now, and a page that renders a plausible-looking empty state
 * would hide which routes are actually finished.
 *
 * Every use is a TODO. When there are none left, the app is feature-complete.
 */
export function Placeholder({
  title,
  phase,
  portsFrom,
  children,
}: {
  title: string;
  /** e.g. "phase 07" — which build phase fills this in. */
  phase: string;
  /** The UI kit file this screen is ported from, if there is one. */
  portsFrom?: string;
  children?: React.ReactNode;
}) {
  return (
    <main
      style={{
        maxWidth: '42rem',
        margin: '0 auto',
        padding: 'var(--space-10, 3rem) var(--space-5, 1.25rem)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {phase}
      </p>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-h1)',
          fontWeight: 700,
          color: 'var(--sable-900)',
          marginTop: 'var(--space-2, 0.5rem)',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h1>

      {portsFrom ? (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
            marginTop: 'var(--space-4, 1rem)',
          }}
        >
          {portsFrom}
        </p>
      ) : null}

      {children ? (
        <div style={{ color: 'var(--sable-600)', marginTop: 'var(--space-4, 1rem)' }}>
          {children}
        </div>
      ) : null}
    </main>
  );
}
