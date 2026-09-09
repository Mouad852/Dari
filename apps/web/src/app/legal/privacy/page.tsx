import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Politique de confidentialité' };

export default function PrivacyPage() {
  // container-prose, not container-max -- see legal/terms for why.
  return (
    <main style={{ maxWidth: 'var(--container-prose)', margin: '0 auto', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-heading)' }}>
      <p style={{ font: 'var(--type-label)', color: 'var(--text-muted)' }}>Dari</p>
      <h1 style={{ font: 'var(--type-h1)' }}>Politique de confidentialité</h1>
      <p style={{ font: 'var(--type-body)', color: 'var(--text-muted)' }}>Version du 5 septembre 2026</p>
      <h2 style={{ font: 'var(--type-h3)' }}>Données utilisées</h2>
      <p>Dari utilise les informations de compte, de profil, d’annonce, de conversation et de signalement nécessaires au fonctionnement du service. Firebase vérifie l’identité de connexion et l’API Dari conserve l’identifiant technique associé.</p>
      <h2 style={{ font: 'var(--type-h3)' }}>Localisation</h2>
      <p>Les coordonnées exactes sont nécessaires pour gérer une annonce et restent accessibles aux parcours propriétaires et à la modération. Les surfaces publiques reçoivent une position approximative, jamais la coordonnée stockée.</p>
      <h2 style={{ font: 'var(--type-h3)' }}>Conservation et suppression</h2>
      <p>Les données de compte et de contenu sont conservées aussi longtemps que nécessaire au service, à la sécurité et au traitement des litiges. Certaines traces historiques restent nécessaires après une suppression de compte pour la modération, les notifications et la sécurité.</p>
      <h2 style={{ font: 'var(--type-h3)' }}>Vos demandes</h2>
      <p>Pour demander l’accès, la correction ou la suppression de données, utilisez le canal de contact communiqué par l’exploitant. Cette page doit être complétée avec l’identité juridique, le contact et les bases légales applicables avant le lancement public.</p>
    </main>
  );
}
