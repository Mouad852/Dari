'use client';

import { useEffect, useState } from 'react';
import { Bell, Mail, ShieldCheck, Smartphone } from 'lucide-react';

import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import type { Me } from '@/types/api';

/**
 * Was a fully static mock: a hardcoded `TOGGLES` array with no `onClick` on
 * any switch, a "Paramètres avancés" button that went nowhere, and a "Canal
 * préféré" row whose chevron implied a channel picker that didn't exist.
 * There is no backend concept of notification preferences at all
 * (`UserService` has no such field, `NotificationDeliveryService` never
 * checks one) and no SMS sender exists (only `SmtpNotificationSender`), so
 * the "Notifications SMS: on" toggle was doubly fake. Found 2026-09-09.
 *
 * What *is* real: the SMTP outbox worker genuinely emails an owner for
 * approval, rejection, suspension, reinstatement, expiry warning, expiry,
 * and report acknowledgment (`NotificationDeliveryService`). That's worth
 * saying plainly instead of dressing it up as a settings page nothing on it
 * actually changes. Per-channel/per-type control is real future work — a
 * migration + endpoint + frontend feature, not a nearby cheap fix — so it's
 * named as "coming soon" rather than faked, same pattern already used on
 * /account/payments and /account/security.
 */
const NOTIFICATION_KINDS = [
  {
    icon: Bell,
    title: 'Nouveaux messages',
    description: 'Un locataire ou un propriétaire vous répond.',
  },
  {
    icon: Mail,
    title: 'Mises à jour de vos annonces',
    description: 'Une annonce est validée, rejetée, suspendue ou arrive à expiration.',
  },
  {
    icon: ShieldCheck,
    title: 'Modération',
    description: 'Un signalement que vous avez envoyé est traité.',
  },
];

export default function AccountNotificationsPage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function load() {
      const idToken = await getIdToken();
      if (!idToken) return;
      try {
        const me = await apiFetch<Me>('/users/me', { token: idToken });
        if (isCurrent) setEmail(me.email);
      } catch (cause) {
        if (!(cause instanceof ApiError)) throw cause;
      }
    }

    void load();
    return () => {
      isCurrent = false;
    };
  }, []);

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
        <div>
          <div
            style={{
              font: 'var(--type-label)',
              letterSpacing: 'var(--ls-caps)',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Compte
          </div>
          <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>
            Notifications
          </h1>
        </div>

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
          <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Vous recevez un e-mail à {email ?? 'votre adresse'} pour chacun de ces événements. Il n’existe pas
            encore de réglage pour les activer ou les désactiver individuellement.
          </p>

          {NOTIFICATION_KINDS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
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
                  flexShrink: 0,
                }}
              >
                <Icon size={18} aria-hidden="true" />
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>
                  {title}
                </div>
                <div style={{ marginTop: 4, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                  {description}
                </div>
              </div>

              <span
                style={{
                  flexShrink: 0,
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--atlas-50)',
                  color: 'var(--atlas-700)',
                  padding: '0.35rem 0.7rem',
                  font: 'var(--type-label)',
                }}
              >
                Activé
              </span>
            </div>
          ))}
        </section>

        <section
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-xs)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
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
              background: 'var(--sable-100)',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <Smartphone size={18} aria-hidden="true" />
          </span>
          <div>
            <div style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>
              Notifications SMS et réglages par canal
            </div>
            <div style={{ marginTop: 4, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
              Pas encore disponible sur Dari.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
