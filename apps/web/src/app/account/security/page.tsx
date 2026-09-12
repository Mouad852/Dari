'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronRight, KeyRound, Lock, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-react';

import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { VERIFICATION_LABELS } from '@/lib/labels';
import type { Me } from '@/types/api';

/**
 * Every row here used to be a hardcoded SECURITY_ITEMS array -- "2 appareils
 * actifs", "Dernière modification il y a 3 mois", "Vérification de compte:
 * Validé" -- none of it backed by anything real, and the last one directly
 * contradicted /account/profile's own (real) "Non vérifié" badge for the
 * same account. Found 2026-09-09. There is no session list or password-
 * change timestamp anywhere in the API, so those two rows say so honestly
 * instead of inventing numbers; only the auth method and verification tier
 * are things `/users/me` actually knows.
 */
type SecurityItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  icon: typeof Lock;
};

export default function AccountSecurityPage() {
  const [profile, setProfile] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function load() {
      try {
        const idToken = await getIdToken();
        if (!idToken) {
          if (isCurrent) setError('Connectez-vous pour voir la sécurité de votre compte.');
          return;
        }
        const me = await apiFetch<Me>('/users/me', { token: idToken });
        if (isCurrent) setProfile(me);
      } catch (cause) {
        if (isCurrent) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger ces informations.');
      }
    }

    void load();
    return () => {
      isCurrent = false;
    };
  }, []);

  const verificationLabel = profile ? VERIFICATION_LABELS[profile.verification] : 'Chargement…';

  const items: SecurityItem[] = [
    {
      id: 'auth-method',
      title: 'Méthode d’authentification',
      detail: profile?.emailVerified ? 'Identité vérifiée via Firebase' : 'Email non confirmé auprès de Firebase',
      status: profile?.emailVerified ? 'Active' : 'À confirmer',
      icon: ShieldCheck,
    },
    {
      id: 'password',
      title: 'Mot de passe',
      detail: 'Géré directement dans Firebase',
      status: 'Non disponible',
      icon: KeyRound,
    },
    {
      id: 'device',
      title: 'Appareils connectés',
      detail: 'Gérés directement dans Firebase',
      status: 'Non disponible',
      icon: Smartphone,
    },
    {
      id: 'review',
      title: 'Vérification de compte',
      detail: profile?.verification === 'NONE'
        ? 'Aucune vérification effectuée pour le moment.'
        : 'Visible sur votre profil public et vos échanges.',
      status: verificationLabel,
      icon: Check,
    },
  ];

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)',
        color: 'var(--text-heading)',
        padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-5)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Compte
            </div>
            <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Sécurité</h1>
          </div>

          {/* No in-app edit flow exists for any of this -- it's all managed in
              Firebase, per the notice below. Disabled rather than removed so
              the page still says plainly what "Modifier" would have meant. */}
          <button
            type="button"
            disabled
            title="Géré directement dans Firebase"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-card)',
              color: 'var(--text-subtle)',
              padding: '0.7rem 1rem',
              font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)',
              cursor: 'not-allowed',
            }}
          >
            Modifier
          </button>
        </header>

        {error ? (
          <section
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-xs)',
              padding: 'var(--space-5)',
            }}
          >
            <p role="alert" style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
              {error}
            </p>
          </section>
        ) : (
          <>
            <section
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-xs)',
                padding: 'var(--space-4)',
                display: 'grid',
                gap: 'var(--space-4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Protection du compte
                  </div>
                  <div style={{ marginTop: 4, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>Gestion par Firebase</div>
                </div>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--atlas-50)',
                    color: 'var(--atlas-700)',
                    padding: '0.45rem 0.7rem',
                    font: 'var(--type-label)',
                  }}
                >
                  <ShieldCheck size={12} />
                  Niveau élevé
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ background: 'var(--sable-50)', borderRadius: 'var(--radius-card-inner)', border: '1px solid var(--border-hairline)', padding: 'var(--space-3)' }}>
                  <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Protection</div>
                  <div style={{ marginTop: 6, font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>Firebase</div>
                </div>
                <div style={{ background: 'var(--sable-50)', borderRadius: 'var(--radius-card-inner)', border: '1px solid var(--border-hairline)', padding: 'var(--space-3)' }}>
                  <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Vérification</div>
                  <div style={{ marginTop: 6, font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>{verificationLabel}</div>
                </div>
                <div style={{ background: 'var(--sable-50)', borderRadius: 'var(--radius-card-inner)', border: '1px solid var(--border-hairline)', padding: 'var(--space-3)' }}>
                  <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Alertes</div>
                  <div style={{ marginTop: 6, font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>Non disponible</div>
                </div>
              </div>
            </section>

            <section
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-xs)',
                padding: 'var(--space-4)',
                display: 'grid',
                gap: 'var(--space-3)',
              }}
            >
              {items.map(({ id, title, detail, status, icon: Icon }) => (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 'var(--radius-card-inner)',
                    background: 'var(--surface-card)',
                    padding: 'var(--space-3)',
                  }}
                >
                  <span
                    style={{
                      width: 42,
                      height: 42,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--brand-subtle)',
                      color: 'var(--clay-700)',
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>{title}</div>
                    <div style={{ marginTop: 4, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>{detail}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.35rem 0.6rem',
                        borderRadius: 'var(--radius-pill)',
                        background: 'var(--atlas-50)',
                        color: 'var(--atlas-700)',
                        font: 'var(--type-label)',
                      }}
                    >
                      {status}
                    </span>
                    <ChevronRight size={18} color="var(--text-subtle)" aria-hidden="true" />
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        <section
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-xs)',
            padding: 'var(--space-4)',
            display: 'grid',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--saffron-700)' }}>
            <TriangleAlert size={18} />
            <div style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)' }}>Attention</div>
          </div>

          {/* Longhand, not the `font` shorthand -- see ReportDialog.tsx for why. */}
          <div style={{ fontWeight: 'var(--weight-regular)', fontSize: 'var(--text-body-sm)', fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            La gestion des sessions, du mot de passe et des alertes de connexion est assurée dans Firebase. Cette page ne simule pas de données d’appareils.
          </div>
        </section>
      </div>
    </main>
  );
}
