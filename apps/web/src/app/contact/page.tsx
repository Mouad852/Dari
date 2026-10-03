import type { Metadata } from 'next';

import { legalRelease } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Écrire à l’équipe Dari : modération, données personnelles et assistance.',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The one public contact channel (owner decision P1-13): the operator's
 * support contact, `DARI_LEGAL_CONTACT`, which a production build already
 * requires. Server-rendered, so the value never needs a NEXT_PUBLIC_ copy. A
 * dedicated moderation mailbox later is only a change of that value.
 */
export default function ContactPage() {
  const contact = legalRelease.contact;
  const reachable = EMAIL.test(contact)
    ? <a href={`mailto:${contact}`} style={{ color: 'var(--brand)', fontWeight: 600 }}>{contact}</a>
    : <strong>{contact}</strong>;

  return (
    <main style={{ maxWidth: 'var(--container-prose)', margin: '0 auto', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-heading)' }}>
      {!legalRelease.isFinal && <p role="note" style={{ color: 'var(--warning)' }}>Brouillon de lancement — coordonnées à confirmer avant publication.</p>}
      <h1 style={{ font: 'var(--type-h1)' }}>Contact</h1>
      {/* A long address must wrap at 360 px rather than scroll the page sideways. */}
      <p style={{ font: 'var(--type-body)', overflowWrap: 'anywhere' }}>Pour écrire à l’équipe Dari : {reachable}</p>

      <h2 id="moderation" style={{ font: 'var(--type-h3)' }}>Une annonce suspendue ou un compte limité</h2>
      <p style={{ font: 'var(--type-body)' }}>
        Indiquez le titre de l’annonce concernée et l’adresse e-mail de votre compte Dari. La modération réexamine la
        décision et vous répond à cette adresse.
      </p>

      <h2 style={{ font: 'var(--type-h3)' }}>Vos données personnelles</h2>
      <p style={{ font: 'var(--type-body)' }}>
        Pour accéder à vos données, les corriger ou les supprimer, écrivez à la même adresse. Vous pouvez aussi supprimer
        votre compte vous-même depuis votre espace.
      </p>
    </main>
  );
}
