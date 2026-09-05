import { ArrowUpRight, Check, ChevronRight, CreditCard, Landmark, ShieldCheck } from 'lucide-react';

type PaymentItem = {
  id: string;
  title: string;
  detail: string;
  value: string;
  icon: typeof CreditCard;
};

const PAYMENT_ITEMS: PaymentItem[] = [
  {
    id: 'visa',
    title: 'Carte bancaire principale',
    detail: '•••• 4582 • Expire fin 2028',
    value: 'Par défaut',
    icon: CreditCard,
  },
  {
    id: 'bank',
    title: 'Compte bancaire',
    detail: 'IBAN • MA 76 0000 0000 0000 0000 0000',
    value: 'Vérifié',
    icon: Landmark,
  },
  {
    id: 'invoice',
    title: 'Factures',
    detail: 'Suivi des versements et d’éventuels remboursements',
    value: '3 reçues',
    icon: Check,
  },
];

export default function AccountPaymentsPage() {
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
            <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Paiements</h1>
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
            Ajouter un moyen
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
                Paiements
              </div>
              <div style={{ marginTop: 4, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>Pas encore disponible</div>
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
              Sécurisé
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--sable-50)', borderRadius: 'var(--radius-card-inner)', border: '1px solid var(--border-hairline)', padding: 'var(--space-3)' }}>
              <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Versements</div>
              <div style={{ marginTop: 6, font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>À venir</div>
            </div>
            <div style={{ background: 'var(--sable-50)', borderRadius: 'var(--radius-card-inner)', border: '1px solid var(--border-hairline)', padding: 'var(--space-3)' }}>
              <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>Remboursements</div>
              <div style={{ marginTop: 6, font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>À venir</div>
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
          {PAYMENT_ITEMS.map(({ id, title, detail, value, icon: Icon }) => (
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
                  {value}
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Historique
            </div>
            <div style={{ marginTop: 4, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>            Historique indisponible</div>
          </div>

          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              border: 'none',
              background: 'transparent',
              color: 'var(--brand)',
              font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)',
              cursor: 'pointer',
            }}
          >
            Le paiement en ligne n’est pas encore disponible
            <ArrowUpRight size={16} />
          </button>
        </section>
      </div>
    </main>
  );
}
