'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ds/Button';
import { Card } from '@/components/ds/Card';
import { apiFetch, ApiError, type CursorPage } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { relativeTime } from '@/lib/format';
import type { Conversation } from '@/types/api';

const TONES = ['brand', 'sand', 'atlas'] as const;

/**
 * Deterministic avatar tint. Not derived from any real category — it exists so
 * a list of initials is scannable rather than uniform.
 *
 * Keyed to the *person*, not the conversation: keying it to `conversation.id`
 * meant the same landlord wore a different colour in every thread, which is the
 * opposite of what a per-person tint is for.
 */
function toneFor(userId: string): (typeof TONES)[number] {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length]!;
}

function avatarStyle(tone: (typeof TONES)[number]) {
  if (tone === 'brand') return { background: 'var(--brand-subtle)', color: 'var(--clay-700)' };
  if (tone === 'sand') return { background: 'var(--sand-100)', color: 'var(--sand-700)' };
  return { background: 'var(--atlas-50)', color: 'var(--atlas-700)' };
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
      // Inside the try: getIdToken rejects rather than resolving null when the
      // Firebase config is missing, and this call used to sit outside it, so a
      // bad config produced an unhandled rejection and a page that said
      // "Chargement…" forever instead of anything actionable.
      try {
        const idToken = await getIdToken();
        if (!idToken) {
          if (isCurrent) setError('Connectez-vous pour voir vos conversations.');
          return;
        }

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
        color: 'var(--text-heading)',
        padding: 'var(--space-6) var(--gutter-mobile) var(--space-8)',
      }}
    >
      <div
        style={{
          maxWidth: 'var(--container-prose)',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 'var(--space-5)',
        }}
      >
        {/*
          The header carried a "{n} conversations" pill that counted the rows
          *loaded*, so it read 20 on an inbox of 300 and ticked upward each time
          "Voir plus" was pressed. Same class of claim as the search page's old
          result count, and there is no total to replace it with — CursorPage
          carries none, by design — so the claim goes rather than the pagination.
        */}
        <header>
          <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Messages
          </div>
          <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Conversations</h1>
        </header>

        {error ? (
          <Card padding="var(--card-pad-lg)" style={{ display: 'grid', gap: 'var(--space-4)', justifyItems: 'start' }}>
            <p role="alert" style={{ margin: 0, color: 'var(--text-body)', font: 'var(--type-body)' }}>{error}</p>
            {!token ? (
              <Link href="/sign-in" style={{ textDecoration: 'none' }}>
                <Button variant="primary">Se connecter</Button>
              </Link>
            ) : null}
          </Card>
        ) : !conversations ? (
          <p style={{ color: 'var(--text-body)', font: 'var(--type-body-sm)' }}>Chargement de vos conversations…</p>
        ) : conversations.length === 0 ? (
          <Card padding="var(--space-7)" style={{ display: 'grid', gap: 'var(--space-3)', textAlign: 'center', justifyItems: 'center' }}>
            <p style={{ margin: 0, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>Aucune conversation</p>
            <p style={{ margin: 0, font: 'var(--type-body-sm)', color: 'var(--text-body)', maxWidth: '38ch' }}>
              Contactez un propriétaire depuis une annonce pour commencer à discuter.
            </p>
            <Link href="/listings" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" iconLeft="search">Parcourir les annonces</Button>
            </Link>
          </Card>
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-3)' }}>
              {conversations.map((conversation) => {
                const tone = toneFor(conversation.otherUserId);
                const preview = conversation.lastMessage ?? 'Aucun message pour le moment';
                const timestamp = conversation.lastMessageAt ?? conversation.createdAt;

                return (
                  <li key={conversation.id} style={{ minWidth: 0 }}>
                    <Link
                      href={`/messages/${conversation.id}`}
                      style={{
                        display: 'flex',
                        gap: 'var(--space-4)',
                        alignItems: 'center',
                        padding: 'var(--card-pad)',
                        border: '1px solid var(--border-hairline)',
                        borderRadius: 'var(--radius-card)',
                        background: 'var(--surface-card)',
                        boxShadow: 'var(--shadow-xs)',
                        textDecoration: 'none',
                        color: 'inherit',
                        minWidth: 0,
                      }}
                    >
                      <span
                        aria-hidden="true"
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
                        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'baseline', marginBottom: 4 }}>
                          <span style={{ font: 'var(--type-label)', color: 'var(--text-heading)' }}>
                            {conversation.otherUserDisplayName}
                          </span>
                          <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {relativeTime(new Date(timestamp))}
                          </span>
                        </span>

                        <span
                          style={{
                            display: 'block',
                            font: 'var(--type-body-sm)',
                            color: 'var(--text-body)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {preview}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {nextCursor ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Button variant="secondary" loading={loadingMore} onClick={handleLoadMore}>
                  {loadingMore ? 'Chargement…' : 'Voir plus'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
