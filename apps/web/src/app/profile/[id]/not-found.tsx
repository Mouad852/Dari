import Link from 'next/link';

/**
 * The root not-found speaks about a listing ("louée ou retirée"), which is the
 * wrong sentence for a profile. Same layout, copy that fits: a profile is
 * missing because the account was deleted or closed, and the page never says
 * which — the API answers 404 for deleted, banned and never-existed alike.
 */
export default function ProfileNotFound() {
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
        Ce profil est introuvable
      </h1>

      <p style={{ color: 'var(--sable-600)', marginTop: 'var(--space-3, 0.75rem)' }}>
        Le compte a peut-être été supprimé.
      </p>

      <p style={{ marginTop: 'var(--space-6, 1.5rem)' }}>
        <Link href="/listings" style={{ color: 'var(--brand)', fontWeight: 600 }}>
          Voir les annonces disponibles
        </Link>
      </p>
    </main>
  );
}
