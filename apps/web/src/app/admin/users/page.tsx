'use client';

import { Ban, ShieldOff, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { apiFetch, ApiError } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { USER_ACCOUNT_STATUS_LABELS } from '@/lib/labels';
import type { AdminUser, UserAccountStatus } from '@/types/api';

const STATUS_STYLE: Record<UserAccountStatus, { bg: string; color: string }> = {
  ACTIVE: { bg: 'var(--brand-subtle)', color: 'var(--clay-700)' },
  SUSPENDED: { bg: 'var(--sand-100)', color: 'var(--sand-700)' },
  BANNED: { bg: 'var(--danger-subtle)', color: 'var(--danger)' },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const rowNameRefs = useRef(new Map<string, HTMLSpanElement>());

  /**
   * Same `disabled={<async state>}` focus loss as the other admin queues,
   * but a different aftermath: a user row is never removed from `users` --
   * suspend/ban both patch `status` in place -- so this is the same
   * "button hides after its own success" shape as `admin/listings`' submit
   * (suspending hides "Suspendre"; banning hides the whole action group,
   * since a banned user gets no actions at all). Falls back to the row's
   * own display-name `<span>` rather than a heading, since that's the only
   * always-rendered per-row element here.
   */
  const lastFocusedBeforeActionRef = useRef<HTMLElement | null>(null);
  const lastActionUserIdRef = useRef<string | null>(null);
  const armActionRefocus = (id: string) => {
    const active = document.activeElement;
    lastFocusedBeforeActionRef.current = active instanceof HTMLElement ? active : null;
    lastActionUserIdRef.current = id;
  };
  useEffect(() => {
    if (pendingId === null && lastFocusedBeforeActionRef.current) {
      const el = lastFocusedBeforeActionRef.current;
      const userId = lastActionUserIdRef.current;
      lastFocusedBeforeActionRef.current = null;
      lastActionUserIdRef.current = null;
      const usable = el.isConnected && !(el instanceof HTMLButtonElement && el.disabled);
      if (usable) {
        el.focus();
      } else {
        const rowName = userId ? rowNameRefs.current.get(userId) : undefined;
        (rowName ?? pageHeadingRef.current)?.focus();
      }
    }
  }, [pendingId]);

  const load = (idToken: string, searchQuery: string) => {
    void (async () => {
      try {
        const params = searchQuery.trim() ? `?query=${encodeURIComponent(searchQuery.trim())}` : '';
        const result = await apiFetch<AdminUser[]>(`/admin/users${params}`, { token: idToken });
        setUsers(result);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les utilisateurs.');
      }
    })();
  };

  useEffect(() => {
    let isCurrent = true;
    void (async () => {
      const idToken = await getIdToken();
      if (!idToken || !isCurrent) return;
      setToken(idToken);
      load(idToken, '');
    })();
    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    if (token) load(token, query);
  };

  const handleSuspend = (id: string) => {
    if (pendingId || !token) return;
    armActionRefocus(id);
    setPendingId(id);
    setError(null);
    void (async () => {
      try {
        await apiFetch(`/admin/users/${encodeURIComponent(id)}/suspend`, { method: 'POST', token });
        setUsers((prev) => (prev ?? []).map((u) => (u.id === id ? { ...u, status: 'SUSPENDED' } : u)));
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Impossible de suspendre ce compte.');
      } finally {
        setPendingId(null);
      }
    })();
  };

  const handleBan = (id: string) => {
    if (pendingId || !token) return;
    if (!window.confirm('Bannir définitivement ce compte ? Ses annonces seront retirées.')) return;
    const reason = window.prompt('Raison du bannissement (facultatif) :') ?? undefined;

    armActionRefocus(id);
    setPendingId(id);
    setError(null);
    void (async () => {
      try {
        await apiFetch(`/admin/users/${encodeURIComponent(id)}/ban`, { method: 'POST', token, body: { reason } });
        setUsers((prev) => (prev ?? []).map((u) => (u.id === id ? { ...u, status: 'BANNED' } : u)));
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Impossible de bannir ce compte.');
      } finally {
        setPendingId(null);
      }
    })();
  };

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
            <h1 ref={pageHeadingRef} tabIndex={-1} style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Utilisateurs</h1>
          </div>

          {users ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-pill)', background: 'var(--brand-subtle)', border: '1px solid var(--brand-border)', color: 'var(--clay-700)', padding: '0.5rem 0.8rem', font: 'var(--type-label)' }}>
              <UserRound size={14} />
              {users.length} compte{users.length > 1 ? 's' : ''}
            </div>
          ) : null}
        </header>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher par nom, email ou ville…"
            style={{
              flex: 1,
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-card)',
              color: 'var(--text-heading)',
              padding: '0.65rem 1rem',
              font: 'var(--type-body)',
            }}
          />
          <button
            type="submit"
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-card)',
              color: 'var(--text-heading)',
              padding: '0.65rem 1.1rem',
              font: 'var(--type-body-sm)',
              cursor: 'pointer',
            }}
          >
            Rechercher
          </button>
        </form>

        {error ? <p role="alert" style={{ margin: 0, color: 'var(--danger)', font: 'var(--type-body-sm)' }}>{error}</p> : null}

        {!users ? (
          <p style={{ color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>Chargement…</p>
        ) : users.length === 0 ? (
          <div
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-xs)',
              padding: 'var(--space-6)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              font: 'var(--type-body-sm)',
            }}
          >
            Aucun utilisateur ne correspond à cette recherche.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {users.map((user) => {
              const statusStyle = STATUS_STYLE[user.status];
              const isPending = pendingId === user.id;

              return (
                <article
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 'var(--radius-card)',
                    boxShadow: 'var(--shadow-xs)',
                    padding: 'var(--space-4)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-avatar)',
                      background: 'linear-gradient(135deg, var(--sand-100), var(--sable-100))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      font: 'var(--weight-bold) 16px/1 var(--font-ui)',
                      color: 'var(--text-heading)',
                      flex: '0 0 auto',
                    }}
                  >
                    {user.displayName.charAt(0).toUpperCase()}
                  </span>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        ref={(el) => {
                          if (el) rowNameRefs.current.set(user.id, el);
                          else rowNameRefs.current.delete(user.id);
                        }}
                        tabIndex={-1}
                        style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}
                      >
                        {user.displayName}
                      </span>
                      <span
                        style={{
                          borderRadius: 'var(--radius-pill)',
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          padding: '0.3rem 0.6rem',
                          font: 'var(--type-label)',
                        }}
                      >
                        {USER_ACCOUNT_STATUS_LABELS[user.status]}
                      </span>
                      {user.role === 'ADMIN' ? (
                        <span style={{ borderRadius: 'var(--radius-pill)', background: 'var(--atlas-50)', color: 'var(--atlas-700)', padding: '0.3rem 0.6rem', font: 'var(--type-label)' }}>
                          Admin
                        </span>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 2, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                      {user.email}{user.city ? ` · ${user.city}` : ''} · {user.reportCount} signalement{user.reportCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {user.role !== 'ADMIN' && user.status !== 'BANNED' ? (
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      {user.status !== 'SUSPENDED' ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSuspend(user.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-pill)',
                            background: 'var(--surface-card)',
                            color: 'var(--text-heading)',
                            padding: '0.55rem 0.85rem',
                            font: 'var(--type-body-sm)',
                            cursor: isPending ? 'default' : 'pointer',
                          }}
                        >
                          <ShieldOff size={14} />
                          Suspendre
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleBan(user.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          border: '1px solid var(--danger-border)',
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--danger-subtle)',
                          color: 'var(--danger)',
                          padding: '0.55rem 0.85rem',
                          font: 'var(--type-body-sm)',
                          cursor: isPending ? 'default' : 'pointer',
                        }}
                      >
                        <Ban size={14} />
                        Bannir
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
