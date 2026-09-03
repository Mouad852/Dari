import { Check, ChevronRight, KeyRound, Lock, ShieldCheck, Smartphone, TriangleAlert } from 'lucide-react';

type SecurityItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  icon: typeof Lock;
};

const SECURITY_ITEMS: SecurityItem[] = [
  {
    id: 'auth-method',
    title: 'Méthode d’authentification',
    detail: 'Identité vérifiée via Firebase',
    status: 'Active',
    icon: ShieldCheck,
  },
  {
    id: 'password',
    title: 'Mot de passe',
    detail: 'Dernière modification il y a 3 mois',
    status: 'À jour',
    icon: KeyRound,
  },
  {
    id: 'device',
    title: 'Appareils connectés',
    detail: '2 appareils actifs sur votre compte',
    status: 'Vérifié',
    icon: Smartphone,
  },
  {
    id: 'review',
    title: 'Vérification de compte',
    detail: 'Profil validé pour les échanges sécurisés',
    status: 'Validé',
    icon: Check,
  },
];

export default function AccountSecurityPage() {
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
            Modifier
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
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div>
              <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Protection du compte
              </div>
              <div style={{ marginTop: 4, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>Votre compte est sécurisé</div>
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
              <div style={{ marginTop: 6, font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>92 %</div>
            </div>
            <div style={{ background: 'var(--sable-50)', borderRadius: 'var(--radius-card-inner)', border: '1px solid var(--border-hairline)', padding: 'var(--space-3)' }}>
              <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Vérification</div>
              <div style={{ marginTop: 6, font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>Oui</div>
            </div>
            <div style={{ background: 'var(--sable-50)', borderRadius: 'var(--radius-card-inner)', border: '1px solid var(--border-hairline)', padding: 'var(--space-3)' }}>
              <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Alertes</div>
              <div style={{ marginTop: 6, font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>2</div>
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
          {SECURITY_ITEMS.map(({ id, title, detail, status, icon: Icon }) => (
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
                <ChevronRight size={18} color="var(--text-subtle)" />
              </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--saffron-700)' }}>
            <TriangleAlert size={18} />
            <div style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)' }}>Attention</div>
          </div>

          <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Vérifiez vos identifiants si un appareil inconnu tente d’accéder à votre compte. Nous vous enverrons une alerte immédiate.
          </div>
        </section>
      </div>
    </main>
  );
}
