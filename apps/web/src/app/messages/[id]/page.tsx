'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronRight, Send } from 'lucide-react';
import { use, useEffect, useState, type FormEvent } from 'react';

import { apiFetch, ApiError, type CursorPage } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { rentPerMonth } from '@/lib/format';
import type { Conversation, Me, Message, PublicListing } from '@/types/api';

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [token, setToken] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [listing, setListing] = useState<PublicListing | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function load() {
      const idToken = await getIdToken();
      if (!idToken) {
        if (isCurrent) setError('Connectez-vous pour voir cette conversation.');
        return;
      }

      try {
        const [me, thread, page] = await Promise.all([
          apiFetch<Me>('/users/me', { token: idToken }),
          apiFetch<Conversation>(`/conversations/${encodeURIComponent(id)}`, { token: idToken }),
          apiFetch<CursorPage<Message>>(`/conversations/${encodeURIComponent(id)}/messages`, { token: idToken }),
        ]);
        if (!isCurrent) return;

        setToken(idToken);
        setMyId(me.id);
        setConversation(thread);
        setMessages(page.items);
        setNextCursor(page.nextCursor);

        // Fire-and-forget: marking read failing shouldn't block reading the thread.
        void apiFetch(`/conversations/${encodeURIComponent(id)}/read`, { method: 'PATCH', token: idToken }).catch(() => {});

        if (thread.listingId) {
          try {
            const relatedListing = await apiFetch<PublicListing>(`/listings/${encodeURIComponent(thread.listingId)}`, { token: idToken });
            if (isCurrent) setListing(relatedListing);
          } catch {
            // The listing may since have been removed; the thread still works without its context card.
          }
        }
      } catch (cause) {
        if (isCurrent) {
          setError(cause instanceof ApiError && cause.status === 403
            ? 'Vous n’avez pas accès à cette conversation.'
            : cause instanceof ApiError ? cause.message : 'Impossible de charger cette conversation.');
        }
      }
    }

    void load();
    return () => {
      isCurrent = false;
    };
  }, [id]);

  const handleLoadMore = () => {
    if (!nextCursor || !token || loadingMore) return;
    setLoadingMore(true);
    void (async () => {
      try {
        const page = await apiFetch<CursorPage<Message>>(
          `/conversations/${encodeURIComponent(id)}/messages?cursor=${encodeURIComponent(nextCursor)}`,
          { token },
        );
        setMessages((prev) => [...(prev ?? []), ...page.items]);
        setNextCursor(page.nextCursor);
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Impossible de charger la suite.');
      } finally {
        setLoadingMore(false);
      }
    })();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value || !token || sending) return;

    setSending(true);
    void (async () => {
      try {
        const sent = await apiFetch<Message>(`/conversations/${encodeURIComponent(id)}/messages`, {
          method: 'POST',
          token,
          body: { body: value },
        });
        setMessages((prev) => [...(prev ?? []), sent]);
        setDraft('');
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : 'Le message n’a pas pu être envoyé.');
      } finally {
        setSending(false);
      }
    })();
  };

  if (error) {
    return (
      <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-muted)' }}>
        <h1 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-heading)' }}>{error}</h1>
        <Link href={token ? '/messages' : '/sign-in'} style={{ color: 'var(--brand)' }}>
          {token ? 'Retour aux messages' : 'Se connecter'}
        </Link>
      </main>
    );
  }

  if (!conversation || !messages || !myId) {
    return <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-muted)' }}>Chargement de la conversation…</main>;
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)',
        color: 'var(--text-heading)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-4) var(--gutter-mobile)',
          borderBottom: '1px solid var(--border-hairline)',
          background: 'var(--surface-card)',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <Link
          href="/messages"
          aria-label="Retour"
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-default)',
            background: 'var(--surface-card)',
            color: 'var(--text-heading)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={18} />
        </Link>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-avatar)',
              background: 'linear-gradient(135deg, var(--sand-100), var(--sable-100))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: 'var(--weight-bold) 16px/1 var(--font-ui)',
              color: 'var(--text-heading)',
            }}
          >
            {conversation.otherUserDisplayName.charAt(0).toUpperCase()}
          </span>
          <div style={{ font: 'var(--type-label)', color: 'var(--text-heading)' }}>{conversation.otherUserDisplayName}</div>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5) var(--gutter-mobile)', display: 'grid', gap: 'var(--space-4)', alignContent: 'start' }}>
        {listing ? (
          <Link
            href={`/listings/${listing.id}`}
            style={{
              display: 'flex',
              gap: 'var(--space-4)',
              alignItems: 'center',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-card)',
              background: 'var(--surface-card)',
              boxShadow: 'var(--shadow-xs)',
              padding: 'var(--space-4)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span
              style={{
                width: 46,
                height: 46,
                borderRadius: 'var(--radius-card-inner)',
                background: 'linear-gradient(135deg, var(--sand-100), var(--sable-100))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: 'var(--type-eyebrow)',
                color: 'var(--text-muted)',
                flex: '0 0 auto',
              }}
            >
              Photo
            </span>

            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: 'var(--type-label)', color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {listing.title}
              </span>
              <span style={{ display: 'block', font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                {rentPerMonth(listing.priceRent)} · {listing.city}
              </span>
            </span>

            <ChevronRight size={18} color="var(--text-subtle)" />
          </Link>
        ) : null}

        {nextCursor ? (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              justifySelf: 'center',
              border: '1px solid var(--border-default)',
              background: 'var(--surface-card)',
              borderRadius: 'var(--radius-pill)',
              color: 'var(--text-heading)',
              padding: '0.5rem 1rem',
              font: 'var(--type-caption)',
              cursor: loadingMore ? 'default' : 'pointer',
            }}
          >
            {loadingMore ? 'Chargement…' : 'Voir les messages suivants'}
          </button>
        ) : null}

        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {messages.map((message) => {
            const me = message.senderId === myId;
            return (
              <div
                key={message.id}
                style={{
                  maxWidth: '78%',
                  justifySelf: me ? 'end' : 'start',
                  padding: '0.8rem 1rem',
                  borderRadius: me
                    ? 'var(--radius-md) var(--radius-md) var(--radius-xs) var(--radius-md)'
                    : 'var(--radius-md) var(--radius-md) var(--radius-md) var(--radius-xs)',
                  background: me ? 'linear-gradient(135deg, var(--brand), var(--brand-hover))' : 'var(--surface-card)',
                  color: me ? '#fff' : 'var(--text-body)',
                  border: me ? 'none' : '1px solid var(--border-hairline)',
                  boxShadow: 'var(--shadow-xs)',
                  font: 'var(--type-body)',
                  lineHeight: 1.5,
                }}
              >
                {message.body}
              </div>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          alignItems: 'center',
          padding: 'var(--space-4) var(--gutter-mobile)',
          background: 'var(--surface-card)',
          borderTop: '1px solid var(--border-hairline)',
          boxShadow: '0 -6px 24px rgba(17, 24, 39, 0.04)',
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Écrire un message…"
          aria-label="Écrire un message"
          disabled={sending}
          style={{
            flex: 1,
            minHeight: 46,
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--surface-card)',
            color: 'var(--text-heading)',
            padding: '0.75rem 1rem',
            font: 'var(--type-body)',
          }}
        />
        <button
          type="submit"
          aria-label="Envoyer"
          disabled={sending || !draft.trim()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            minHeight: 46,
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            background: 'linear-gradient(135deg, var(--brand), var(--brand-hover))',
            color: '#fff',
            padding: '0 16px',
            font: 'var(--weight-semibold) var(--type-body) var(--font-ui)',
            cursor: sending ? 'default' : 'pointer',
            opacity: sending ? 0.7 : 1,
            boxShadow: 'var(--shadow-brand)',
          }}
        >
          <Send size={16} />
          Envoyer
        </button>
      </form>
    </main>
  );
}
