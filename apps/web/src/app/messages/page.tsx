'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { apiFetch, ApiError, type CursorPage } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { relativeTime } from '@/lib/format';
import type { Conversation } from '@/types/api';

const TONES = ['brand', 'sand', 'atlas'] as const;

/** Deterministic per conversation, purely for visual variety — not derived from any real category. */
function toneFor(id: string): (typeof TONES)[number] {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length]!;
}

function avatarStyle(tone: (typeof TONES)[number]) {
  if (tone === 'brand') return { background: 'linear-gradient(135deg, var(--clay-100), var(--brand-subtle))', color: 'var(--clay-700)' };
  if (tone === 'sand') return { background: 'linear-gradient(135deg, var(--sand-100), var(--sable-100))', color: 'var(--sand-700)' };
  return { background: 'linear-gradient(135deg, var(--atlas-50), var(--brand-subtle))', color: 'var(--atlas-700)' };
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function load() {
      const idToken = await getIdToken();
      if (!idToken) {
        if (isCurrent) setError('Connectez-vous pour voir vos conversations.');
        return;
      }

      try {
        const page = await apiFetch<CursorPage<Conversation>>('/conversations', { token: idToken });
        if (isCurrent) {
          setToken(idToken);
          setConversations(page.items);
          setNextCursor(page.nextCursor);
        }
      } catch (cause) {
        if (isCurrent) setError(cause instanceof ApiError ? cause.message : 'Impossible de charger vos conversations.');
      }
    }

    void load();
    return () => {
      isCurrent = false;
    };
  }, []);

  const handleLoadMore = () => {
    if (!nextCursor || !token || loadingMore) return;
    setLoadingMore(true);
    void (async () => {
      try {
        const page = await apiFetch<CursorPage<Conversation>>(
          `/conversations?cursor=${encodeURIComponent(nextCursor)}`,
          { token },
        );
        setConversations((prev) => [...(prev ?? []), ...page.items]);
        setNextCursor(page.nextCursor);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Impossible de charger la suite.');
      } finally {
        setLoadingMore(false);
      }
    })();
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: 'var(--space-6) 0 var(--space-8)' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            padding: '0 var(--gutter-mobile)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <div>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Messages
            </div>
            <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Conversations</h1>
          </div>

          {conversations && conversations.length > 0 ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 32,
                borderRadius: 'var(--radius-pill)',
                background: 'var(--brand-subtle)',
                color: 'var(--brand)',
                padding: '0.45rem 0.8rem',
                font: 'var(--weight-medium) var(--type-label) var(--font-ui)',
              }}
            >
              {conversations.length} conversation{conversations.length > 1 ? 's' : ''}
            </span>
          ) : null}
        </header>

        <div style={{ padding: '0 var(--gutter-mobile)' }}>
          {error ? (
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <p role="alert" style={{ margin: 0, color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>{error}</p>
              {!token ? <Link href="/sign-in" style={{ color: 'var(--brand)' }}>Se connecter</Link> : null}
            </div>
          ) : !conversations ? (
            <p style={{ color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>Chargement de vos conversations…</p>
          ) : conversations.length === 0 ? (
            <div
              style={{
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-card)',
                background: 'var(--surface-card)',
                boxShadow: 'var(--shadow-xs)',
                padding: 'var(--space-6)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                font: 'var(--type-body-sm)',
              }}
            >
              Aucune conversation pour le moment. Contactez un propriétaire depuis une annonce pour commencer à discuter.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {conversations.map((conversation) => {
                  const tone = toneFor(conversation.id);
                  const preview = conversation.lastMessage ?? 'Aucun message pour le moment';
                  const timestamp = conversation.lastMessageAt ?? conversation.createdAt;

                  return (
                    <Link
                      key={conversation.id}
                      href={`/messages/${conversation.id}`}
                      style={{
                        display: 'flex',
                        gap: 'var(--space-4)',
                        width: '100%',
                        alignItems: 'center',
                        padding: 'var(--space-4)',
                        border: '1px solid var(--border-hairline)',
                        borderRadius: 'var(--radius-card)',
                        background: 'var(--surface-card)',
                        boxShadow: 'var(--shadow-xs)',
                        textAlign: 'left',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <span
                        style={{
                          width: 52,
                          height: 52,
                          flex: '0 0 auto',
                          borderRadius: 'var(--radius-avatar)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          font: 'var(--weight-bold) 18px/1 var(--font-ui)',
                          ...avatarStyle(tone),
                        }}
                      >
                        {conversation.otherUserDisplayName.charAt(0).toUpperCase()}
                      </span>

                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                          <span style={{ font: 'var(--type-label)', color: 'var(--text-heading)' }}>{conversation.otherUserDisplayName}</span>
                          <span style={{ font: 'var(--type-caption)', color: 'var(--text-subtle)' }}>{relativeTime(new Date(timestamp))}</span>
                        </span>

                        <span
                          style={{
                            display: 'block',
                            font: 'var(--type-body-sm)',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {preview}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>

              {nextCursor ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-4)' }}>
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    style={{
                      border: '1px solid var(--border-default)',
                      background: 'var(--surface-card)',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--text-primary)',
                      padding: '0.7rem 1.3rem',
                      font: 'var(--type-body-sm)',
                      cursor: loadingMore ? 'default' : 'pointer',
                    }}
                  >
                    {loadingMore ? 'Chargement…' : 'Voir plus'}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
