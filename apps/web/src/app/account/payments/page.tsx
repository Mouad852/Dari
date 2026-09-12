import { ArrowUpRight, CreditCard, ShieldCheck } from 'lucide-react';

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

          {/*
            Disabled, not hidden: the section below already tells the visitor
            payments aren't live yet, and this button had no onClick at all --
            a dead control that looked clickable is worse than one that says
            plainly it isn't ready.
          */}
          <button
            type="button"
            disabled
            title="Cette fonctionnalité arrive bientôt"
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
            padding: 'var(--space-6)',
            display: 'grid',
            justifyItems: 'center',
            textAlign: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <span
            style={{
              width: 72,
              height: 72,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: 'var(--brand-subtle)',
              color: 'var(--clay-700)',
            }}
          >
            <CreditCard size={28} />
          </span>
          <div>
            <h2 style={{ margin: 0, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>Aucun moyen de paiement</h2>
            <p style={{ margin: '0.55rem 0 0', font: 'var(--type-body-sm)', color: 'var(--text-muted)', maxWidth: 360 }}>
              Les paiements en ligne arrivent bientôt sur Dari.
            </p>
          </div>
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
            <div style={{ marginTop: 4, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>Historique indisponible</div>
          </div>

          {/*
            Same fix as "Ajouter un moyen" above, for the identical reason:
            this had no `onClick` at all, but was styled and coloured exactly
            like a live link (brand colour, pointer cursor, a trailing
            arrow-up-right that visually promises "goes somewhere") -- a dead
            control indistinguishable from a working one, for keyboard and
            mouse users alike. `disabled` says plainly it isn't ready instead.
          */}
          <button
            type="button"
            disabled
            title="Cette fonctionnalité arrive bientôt"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-subtle)',
              font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)',
              cursor: 'not-allowed',
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
