import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Données de localisation' };

export default function LocationDataPage() {
  return (
    <main style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-heading)' }}>
      <p style={{ font: 'var(--type-label)', color: 'var(--text-muted)' }}>Dari</p>
      <h1 style={{ font: 'var(--type-h1)' }}>Données de localisation</h1>
      <p>Une annonce peut contenir une adresse ou une position précise afin que son propriétaire la gère et que Dari puisse contrôler sa cohérence. Cette position précise n’est pas renvoyée dans la recherche publique, les cartes publiques, les pages de détail ou les favoris.</p>
      <p>Les visiteurs voient une position volontairement décalée autour du logement. La distance et le rayon de recherche ne doivent donc pas être utilisés pour retrouver une adresse exacte. Les administrateurs autorisés peuvent voir la position nécessaire à la modération.</p>
      <p>Ne publiez pas de détails permettant d’identifier une personne ou un domicile dans le titre, les photos ou les messages. Signalez immédiatement une exposition accidentelle à la modération.</p>
    </main>
  );
}
