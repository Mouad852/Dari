import Link from 'next/link';
import { MapPin, ShieldCheck } from 'lucide-react';

import { apiFetch, ApiError } from '@/lib/api';
import { VERIFICATION_LABELS } from '@/lib/labels';
import type { PublicProfile } from '@/types/api';

import { ContactButton } from './ContactButton';

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let profile: PublicProfile;
  try {
    profile = await apiFetch<PublicProfile>(`/users/${encodeURIComponent(id)}`);
  } catch (cause) {
    return (
      <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-muted)' }}>
        <h1 style={{ font: 'var(--type-h2)', color: 'var(--text-heading)' }}>
          {cause instanceof ApiError && cause.status === 404 ? 'Ce profil est introuvable.' : 'Une erreur est survenue.'}
        </h1>
        <Link href="/" style={{ color: 'var(--brand)' }}>Retour à l’accueil</Link>
      </main>
    );
  }

  const memberSince = new Date(profile.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-6)' }}>
        <span style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Profil public
        </span>

        <section style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span
            style={{
              width: 72,
              height: 72,
              borderRadius: 'var(--radius-avatar)',
              background: 'linear-gradient(135deg, var(--clay-100), var(--sand-100))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: 'var(--weight-extra) 26px/1 var(--font-display)',
              color: 'var(--clay-700)',
            }}
          >
            {profile.displayName.charAt(0).toUpperCase()}
          </span>
          <span style={{ flex: 1, minWidth: 200 }}>
            <span style={{ display: 'block', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>{profile.displayName}</span>
            {profile.city ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                <MapPin size={12} />
                {profile.city}
              </span>
            ) : null}
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  borderRadius: 'var(--radius-pill)',
                  background: profile.verification === 'NONE' ? 'var(--sable-100)' : 'var(--atlas-50)',
                  color: profile.verification === 'NONE' ? 'var(--text-muted)' : 'var(--atlas-700)',
                  padding: '0.38rem 0.68rem',
                  font: 'var(--type-label)',
                }}
              >
                <ShieldCheck size={12} />
                {VERIFICATION_LABELS[profile.verification]}
              </span>
              <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Membre depuis {memberSince}</span>
            </span>
          </span>
        </section>

        {profile.bio ? (
          <section
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--space-5)',
            }}
          >
            <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--text-primary)', lineHeight: 1.6 }}>{profile.bio}</p>
          </section>
        ) : null}

        <section
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <span style={{ font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>Annonces actives</span>
          <span style={{ font: 'var(--weight-bold) var(--type-h3) var(--font-ui)', color: 'var(--text-heading)' }}>{profile.activeListingCount}</span>
        </section>

        <ContactButton userId={profile.id} />
      </div>
    </main>
  );
}
