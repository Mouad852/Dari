'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Check, KeyRound, Lock, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ds/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken, sendPasswordReset } from '@/lib/firebase';
import { VERIFICATION_LABELS } from '@/lib/labels';
import type { Me } from '@/types/api';

/**
 * Every row here used to be a hardcoded SECURITY_ITEMS array -- "2 appareils
 * actifs", "Dernière modification il y a 3 mois", "Vérification de compte:
 * Validé" -- none of it backed by anything real, and the last one directly
 * contradicted /account/profile's own (real) "Non vérifié" badge for the
 * same account. Found 2026-09-09.
 *
 * The replacement still said password and devices were "Géré directement
 * dans Firebase", under a hard-coded "Niveau élevé" badge -- a console no
 * member can open (audit P1-12). The page now shows only what `/users/me`
 * knows, plus the one action a member can actually take: a password-reset
 * email to their own address. There is no session list in the API, so there
 * is no devices row.
 */
type SecurityItem = {
  id: string;
  title: string;
  detail: string;
  status?: string;
  action?: ReactNode;
  icon: typeof Lock;
};

type ResetStatus = 'idle' | 'sending' | 'sent' | 'failed';

export default function AccountSecurityPage() {
  const [profile, setProfile] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<ResetStatus>('idle');

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

  /**
   * The same Firebase reset flow as "Mot de passe oublié ?" on /sign-in, sent
   * to the signed-in account's own address -- so, unlike sign-in, there is no
   * account-enumeration concern and any failure is reported as one.
   */
  async function handlePasswordReset() {
    if (!profile) return;
    setResetStatus('sending');
    try {
      await sendPasswordReset(profile.email);
      setResetStatus('sent');
    } catch {
      setResetStatus('failed');
    }
  }

  const verificationLabel = profile ? VERIFICATION_LABELS[profile.verification] : 'Chargement…';
  const emailStatus = profile ? (profile.emailVerified ? 'Confirmé' : 'À confirmer') : 'Chargement…';

  const items: SecurityItem[] = [
    {
      id: 'auth-method',
      title: 'Méthode d’authentification',
      detail: profile?.emailVerified ? 'E-mail et mot de passe, adresse confirmée' : 'E-mail et mot de passe, adresse non confirmée',
      status: profile?.emailVerified ? 'Active' : 'À confirmer',
      icon: ShieldCheck,
    },
    {
      id: 'password',
      title: 'Mot de passe',
      detail: profile
        ? `Recevez à ${profile.email} un lien pour choisir un nouveau mot de passe.`
        : 'Recevez par e-mail un lien pour choisir un nouveau mot de passe.',
      action: (
        <Button variant="secondary" size="sm" loading={resetStatus === 'sending'} disabled={!profile} onClick={handlePasswordReset}>
          Changer mon mot de passe
        </Button>
      ),
      icon: KeyRound,
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
        <header>
          <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Compte
          </div>
          <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Sécurité</h1>
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
              <div>
                <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Protection du compte
                </div>
                <div style={{ marginTop: 4, font: 'var(--type-h3)', color: 'var(--text-heading)', overflowWrap: 'anywhere' }}>
                  {profile?.email ?? 'Chargement…'}
                </div>
              </div>

              <div className="stat-grid">
                <div style={{ background: 'var(--sable-50)', borderRadius: 'var(--radius-card-inner)', border: '1px solid var(--border-hairline)', padding: 'var(--space-3)' }}>
                  <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Connexion</div>
                  <div style={{ marginTop: 6, font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>E-mail</div>
                </div>
                <div style={{ background: 'var(--sable-50)', borderRadius: 'var(--radius-card-inner)', border: '1px solid var(--border-hairline)', padding: 'var(--space-3)' }}>
                  <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Vérification</div>
                  <div style={{ marginTop: 6, font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>{verificationLabel}</div>
                </div>
                <div style={{ background: 'var(--sable-50)', borderRadius: 'var(--radius-card-inner)', border: '1px solid var(--border-hairline)', padding: 'var(--space-3)' }}>
                  <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Adresse e-mail</div>
                  <div style={{ marginTop: 6, font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>{emailStatus}</div>
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
              {items.map(({ id, title, detail, status, action, icon: Icon }) => (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
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
                      flexShrink: 0,
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

                  <div style={{ flex: '1 1 12rem', minWidth: 0 }}>
                    <div style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>{title}</div>
                    <div style={{ marginTop: 4, font: 'var(--type-body-sm)', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{detail}</div>
                  </div>

                  {action ?? (
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
                  )}
                </div>
              ))}

              {resetStatus === 'sent' && profile ? (
                <p role="status" style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-heading)' }}>
                  Un e-mail de réinitialisation vient d’être envoyé à {profile.email}. Le lien vous permet de choisir un nouveau mot de passe.
                </p>
              ) : null}
              {resetStatus === 'failed' ? (
                <p role="alert" style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--danger)' }}>
                  Impossible d’envoyer l’e-mail pour le moment. Réessayez.
                </p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
