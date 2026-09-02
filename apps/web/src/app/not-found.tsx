import Link from 'next/link';

/**
 * Also what a delisted listing renders — suspended, expired or let. That is a
 * routine outcome on this site, not an error, so the copy does not treat the
 * visitor as having done something wrong.
 */
export default function NotFound() {
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
        Cette page n’existe plus
      </h1>

      <p style={{ color: 'var(--sable-600)', marginTop: 'var(--space-3, 0.75rem)' }}>
        L’annonce a peut-être été louée ou retirée.
      </p>

      {/* Verb-first and specific, per the copy rules. Never "Retour". */}
      <p style={{ marginTop: 'var(--space-6, 1.5rem)' }}>
        <Link href="/listings" style={{ color: 'var(--brand)', fontWeight: 600 }}>
          Voir les annonces disponibles
        </Link>
      </p>
    </main>
  );
}
