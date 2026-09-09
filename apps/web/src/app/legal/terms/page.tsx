import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Conditions d’utilisation' };

export default function TermsPage() {
  // container-prose (660px), not container-max (1200px) -- this is long-form
  // reading text, and the page-grid width ran lines well past a comfortable
  // measure. The token exists in spacing.css for exactly this and nothing
  // in the app was using it. Found 2026-09-09.
  return (
    <main style={{ maxWidth: 'var(--container-prose)', margin: '0 auto', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-heading)' }}>
      <p style={{ font: 'var(--type-label)', color: 'var(--text-muted)' }}>Dari</p>
      <h1 style={{ font: 'var(--type-h1)' }}>Conditions d’utilisation</h1>
      <p style={{ font: 'var(--type-body)', color: 'var(--text-muted)' }}>Version du 5 septembre 2026</p>
      <h2 style={{ font: 'var(--type-h3)' }}>Rôle de Dari</h2>
      <p>Dari met en relation des personnes qui cherchent ou proposent une colocation. Dari ne signe pas le bail, ne détient pas les logements et ne garantit pas la conclusion d’une location.</p>
      <h2 style={{ font: 'var(--type-h3)' }}>Utilisation loyale</h2>
      <p>Les informations publiées doivent être exactes, à jour et respectueuses. Il est interdit de publier une annonce trompeuse, de demander un paiement frauduleux, de harceler un membre ou de contourner une suspension.</p>
      <h2 style={{ font: 'var(--type-h3)' }}>Signalements</h2>
      <p>Un signalement peut être examiné par la modération. Les décisions peuvent retirer une annonce, limiter un compte ou le suspendre lorsque cela est nécessaire pour protéger la communauté.</p>
      <h2 style={{ font: 'var(--type-h3)' }}>Limites</h2>
      <p>Les membres doivent vérifier le logement, l’identité de leur interlocuteur et les conditions de location avant tout engagement. Ces conditions doivent être relues et complétées avec les mentions légales de l’exploitant avant ouverture au public.</p>
    </main>
  );
}
