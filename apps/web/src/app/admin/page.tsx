'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, ClipboardList, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';

interface DashboardCounts {
  pendingReviews: number;
  pendingReports: number;
}

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void (async () => {
      const token = await getIdToken();
      if (!token) return;
      try {
        const result = await apiFetch<DashboardCounts>('/admin/dashboard', { token });
        if (isCurrent) setCounts(result);
      } catch (cause) {
        if (isCurrent) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger le tableau de bord.');
      }
    })();

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
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Administration
            </div>
            <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Tableau de bord</h1>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--brand-subtle)',
              border: '1px solid var(--brand-border)',
              color: 'var(--clay-700)',
              padding: '0.5rem 0.8rem',
              font: 'var(--type-label)',
            }}
          >
            <ShieldCheck size={14} />
            Accès administrateur
          </div>
        </header>

        {error ? (
          <p role="alert" style={{ margin: 0, color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>{error}</p>
        ) : !counts ? (
          <p style={{ color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>Chargement…</p>
        ) : (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-4)' }}>
            <Link
              href="/admin/listings"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                background: 'var(--surface-card)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-xs)',
                padding: 'var(--space-5)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--brand-subtle)',
                    color: 'var(--clay-700)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ClipboardList size={20} />
                </span>
                <div>
                  <div style={{ font: 'var(--weight-bold) var(--type-h2) var(--font-ui)', color: 'var(--text-heading)' }}>{counts.pendingReviews}</div>
                  <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>Annonces en attente de validation</div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--text-subtle)" />
            </Link>

            <Link
              href="/admin/reports"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                background: 'var(--surface-card)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-xs)',
                padding: 'var(--space-5)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--danger-subtle)',
                    color: 'var(--danger)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertTriangle size={20} />
                </span>
                <div>
                  <div style={{ font: 'var(--weight-bold) var(--type-h2) var(--font-ui)', color: 'var(--text-heading)' }}>{counts.pendingReports}</div>
                  <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>Signalements en attente</div>
                </div>
              </div>
              <ArrowRight size={18} color="var(--text-subtle)" />
            </Link>
          </section>
        )}

        <Link href="/admin/users" style={{ color: 'var(--brand)', font: 'var(--weight-medium) var(--type-body-sm) var(--font-ui)' }}>
          Gérer les utilisateurs →
        </Link>
      </div>
    </main>
  );
}
