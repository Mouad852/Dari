import { Bell, Check, ChevronRight, Mail, ShieldCheck, Smartphone } from 'lucide-react';

type ToggleRow = {
  id: string;
  title: string;
  description: string;
  icon: typeof Bell;
  enabled: boolean;
};

const TOGGLES: ToggleRow[] = [
  {
    id: 'new-message',
    title: 'Nouveaux messages',
    description: 'Recevoir une alerte lorsqu’un locataire ou un propriétaire répond.',
    icon: Bell,
    enabled: true,
  },
  {
    id: 'listing-update',
    title: 'Mises à jour de vos annonces',
    description: 'Recevoir un rappel quand une annonce est vue, validée ou rejetée.',
    icon: Mail,
    enabled: true,
  },
  {
    id: 'security-alerts',
    title: 'Alertes de sécurité',
    description: 'Recevoir un rappel sur les vérifications et la protection du compte.',
    icon: ShieldCheck,
    enabled: false,
  },
  {
    id: 'sms',
    title: 'Notifications SMS',
    description: 'Recevoir des alertes prioritaires sur votre téléphone mobile.',
    icon: Smartphone,
    enabled: true,
  },
];

export default function AccountNotificationsPage() {
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
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
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

          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-card)',
              color: 'var(--text-heading)',
              padding: '0.7rem 1rem',
              font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)',
              cursor: 'pointer',
            }}
          >
            Paramètres avancés
          </button>
        </header>

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
          {TOGGLES.map(({ id, title, description, icon: Icon, enabled }) => (
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
                <Icon size={18} />
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>
                  {title}
                </div>
                <div style={{ marginTop: 4, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                  {description}
                </div>
              </div>

              <button
                type="button"
                aria-pressed={enabled}
                style={{
                  position: 'relative',
                  width: 52,
                  height: 30,
                  borderRadius: '999px',
                  border: 'none',
                  background: enabled ? 'var(--brand)' : 'var(--sable-200)',
                  cursor: 'pointer',
                  transition: 'background 180ms ease',
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 4,
                    left: enabled ? 28 : 4,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: 'var(--shadow-xs)',
                    transition: 'left 180ms ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {enabled ? <Check size={12} color="var(--brand)" /> : null}
                </span>
              </button>
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
            display: 'grid',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Canal préféré
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              padding: 'var(--space-3)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-card-inner)',
            }}
          >
            <div>
              <div style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>
                E-mail principal
              </div>
              <div style={{ marginTop: 4, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                salma@dari.ma
              </div>
            </div>

            <ChevronRight size={18} color="var(--text-subtle)" />
          </div>
        </section>
      </div>
    </main>
  );
}
