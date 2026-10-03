import Link from 'next/link';

const linkStyle = { color: 'var(--clay-700)', textDecoration: 'underline' } as const;

/**
 * The consent sentence next to the button that creates the profile (owner
 * decision P1-15). The links open a new tab so the half-filled form survives
 * reading them. Which version the person saw is sent with the profile.
 */
export function TermsConsent({ lead }: { lead: string }) {
  return (
    <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
      {lead}, vous acceptez les{' '}
      <Link href="/legal/terms" target="_blank" rel="noopener" style={linkStyle}>
        Conditions d’utilisation<span className="visually-hidden"> (nouvel onglet)</span>
      </Link>{' '}
      et la{' '}
      <Link href="/legal/privacy" target="_blank" rel="noopener" style={linkStyle}>
        Politique de confidentialité<span className="visually-hidden"> (nouvel onglet)</span>
      </Link>{' '}
      de Dari.
    </p>
  );
}
