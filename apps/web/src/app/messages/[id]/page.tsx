'use client';

import Link from 'next/link';
import { use, useEffect, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { IconButton } from '@/components/ds/IconButton';
import { apiFetch, ApiError, apiOrigin, type CursorPage } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { clockTime, dayLabel, rentPerMonth } from '@/lib/format';
import type { Conversation, Me, Message, PublicListing } from '@/types/api';

/**
 * How the thread's listing context resolved.
 *
 * The card used to be rendered from `listing | null`, so a listing that had been
 * suspended, expired or deleted simply vanished from the thread — and the two
 * seekers discussing it had no way to tell whether they were still talking about
 * something rentable. A thread that has a `listingId` always says something.
 */
type ListingContext =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'ok'; listing: PublicListing }
  | { state: 'unavailable' };

/**
 * Reading width for the thread.
 *
 * The screen is a full-height column — sticky header, scrolling messages, fixed
 * composer — so it has no `--container-max` wrapper, and on a 1280px display
 * that put a bubble at 78% of 1280 and ran the composer the whole way across.
 * A message is prose; it gets a prose measure. The bars still span the viewport,
 * only their contents are centred.
 */
const THREAD_COLUMN = { width: '100%', maxWidth: 760, margin: '0 auto', minWidth: 0 } as const;

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [token, setToken] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [context, setContext] = useState<ListingContext>({ state: 'none' });
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function load() {
      // Inside the try for the same reason as the inbox: getIdToken rejects on a
      // missing Firebase config, and outside it that became an unhandled
      // rejection and a permanent "Chargement de la conversation…".
      try {
        const idToken = await getIdToken();
        if (!idToken) {
          if (isCurrent) setError('Connectez-vous pour voir cette conversation.');
          return;
        }

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
          setContext({ state: 'loading' });
          try {
            const relatedListing = await apiFetch<PublicListing>(`/listings/${encodeURIComponent(thread.listingId)}`, { token: idToken });
            if (isCurrent) setContext({ state: 'ok', listing: relatedListing });
          } catch {
            // Suspended, expired or removed: the endpoint 404s for anything not
            // publicly visible. Said out loud rather than left as a gap.
            if (isCurrent) setContext({ state: 'unavailable' });
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

  /**
   * Land on the newest message, and stay there after sending.
   *
   * The thread opened scrolled to the top before, which for a conversation of
   * any length means opening on its first message. `auto` on the first paint so
   * there is no visible scroll animation on load; the browser respects
   * prefers-reduced-motion for `smooth` afterwards.
   */
  const messageCount = messages?.length ?? 0;
  const hasScrolled = useRef(false);
  useEffect(() => {
    if (messageCount === 0) return;
    endRef.current?.scrollIntoView({ behavior: hasScrolled.current ? 'smooth' : 'auto', block: 'end' });
    hasScrolled.current = true;
  }, [messageCount]);

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
      <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', display: 'grid', gap: 'var(--space-4)', justifyItems: 'start', alignContent: 'start' }}>
        <h1 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-heading)' }}>{error}</h1>
        <Link href={token ? '/messages' : '/sign-in'} style={{ textDecoration: 'none' }}>
          <Button variant="secondary" iconLeft={token ? 'arrow-left' : undefined}>
            {token ? 'Retour aux messages' : 'Se connecter'}
          </Button>
        </Link>
      </main>
    );
  }

  if (!conversation || !messages || !myId) {
    return <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-body)' }}>Chargement de la conversation…</main>;
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
          padding: 'var(--space-4) var(--gutter-mobile)',
          borderBottom: '1px solid var(--border-hairline)',
          background: 'var(--surface-card)',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div style={{ ...THREAD_COLUMN, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <Link href="/messages" style={{ display: 'inline-flex', textDecoration: 'none' }}>
          <IconButton icon="arrow-left" size="sm" variant="secondary" label="Retour aux conversations" />
        </Link>

        <span
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-avatar)',
            background: 'var(--sand-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: 'var(--weight-bold) 16px/1 var(--font-ui)',
            color: 'var(--sand-700)',
          }}
        >
          {conversation.otherUserDisplayName.charAt(0).toUpperCase()}
        </span>
        <h1 style={{ margin: 0, flex: 1, minWidth: 0, font: 'var(--type-label)', color: 'var(--text-heading)' }}>
          {conversation.otherUserDisplayName}
        </h1>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5) var(--gutter-mobile)' }}>
        <div
          style={{
            ...THREAD_COLUMN,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 'var(--space-4)',
            alignContent: 'start',
          }}
        >
        <ListingContextCard context={context} />

        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-3)' }}>
          {messages.map((message, index) => {
            const mine = message.senderId === myId;
            const sentAt = new Date(message.sentAt);
            const previous = messages[index - 1];
            // A separator whenever the calendar day changes, so a thread read top
            // to bottom shows when the gaps were.
            const newDay = !previous || new Date(previous.sentAt).toDateString() !== sentAt.toDateString();

            return (
              <li key={message.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-3)' }}>
                {newDay && (
                  <span
                    style={{
                      justifySelf: 'center',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--sable-100)',
                      color: 'var(--text-body)',
                      font: 'var(--type-caption)',
                    }}
                  >
                    {dayLabel(sentAt)}
                  </span>
                )}

                <div
                  style={{
                    maxWidth: '78%',
                    justifySelf: mine ? 'end' : 'start',
                    padding: '0.7rem 0.9rem',
                    borderRadius: mine
                      ? 'var(--radius-md) var(--radius-md) var(--radius-xs) var(--radius-md)'
                      : 'var(--radius-md) var(--radius-md) var(--radius-md) var(--radius-xs)',
                    background: mine ? 'var(--brand)' : 'var(--surface-card)',
                    color: mine ? 'var(--text-on-brand)' : 'var(--text-body)',
                    border: mine ? '1px solid var(--brand)' : '1px solid var(--border-hairline)',
                    boxShadow: 'var(--shadow-xs)',
                    font: 'var(--type-body)',
                    lineHeight: 1.5,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {message.body}
                  {/*
                    A bubble with no time on it leaves a reader guessing whether a
                    reply came back in five minutes or five days. The hour goes
                    here; the day is carried by the separator above.
                  */}
                  <time
                    dateTime={message.sentAt}
                    style={{
                      display: 'block',
                      marginTop: 4,
                      textAlign: 'right',
                      font: 'var(--type-caption)',
                      // Full opacity, not the 0.82 that would read as "quieter":
                      // white on --brand is 4.87:1, and 82% of it is 3.81 — under
                      // AA for text this size. The hierarchy comes from the size.
                      color: mine ? 'var(--text-on-brand)' : 'var(--text-muted)',
                    }}
                  >
                    {clockTime(sentAt)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>

        {/*
          Below the list, not above it. The API pages forward in time — the
          repository orders `sentAt asc` and the cursor asks for rows *after* the
          last one — so this button loads what comes next, and it sat above the
          messages it was going to append underneath them.
        */}
        {nextCursor ? (
          <Button variant="secondary" size="sm" loading={loadingMore} onClick={handleLoadMore} style={{ justifySelf: 'center' }}>
            {loadingMore ? 'Chargement…' : 'Voir les messages suivants'}
          </Button>
        ) : null}

        <div ref={endRef} />
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          padding: 'var(--space-4) var(--gutter-mobile)',
          background: 'var(--surface-card)',
          borderTop: '1px solid var(--border-hairline)',
        }}
      >
        <div style={{ ...THREAD_COLUMN, display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        {/*
          A bare input rather than the design system's Input: this one is a pill
          in a composer bar, not a labelled form field, and Input's label block
          and helper row are the wrong shape here. The border, radius and focus
          treatment still come from the same tokens.
        */}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Écrire un message…"
          aria-label="Écrire un message"
          disabled={sending}
          style={{
            flex: 1,
            minWidth: 0,
            height: 'var(--control-h-md)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--surface-card)',
            color: 'var(--text-heading)',
            padding: '0 16px',
            font: 'var(--type-body)',
          }}
        />
        <Button type="submit" variant="primary" iconLeft="send" loading={sending} disabled={!draft.trim()}>
          Envoyer
        </Button>
        </div>
      </form>
    </main>
  );
}

/**
 * The listing this thread is about.
 *
 * The photo is the real cover, not a box with the word "Photo" in it — the
 * placeholder was the last of those left in the app, and `PublicListing` has
 * carried `coverPhotoUrl` since the photo work landed.
 */
function ListingContextCard({ context }: { context: ListingContext }) {
  if (context.state === 'none' || context.state === 'loading') return null;

  const shell = {
    display: 'flex',
    gap: 'var(--space-4)',
    alignItems: 'center',
    border: '1px solid var(--border-hairline)',
    borderRadius: 'var(--radius-card)',
    background: 'var(--surface-card)',
    boxShadow: 'var(--shadow-xs)',
    padding: 'var(--card-pad)',
    textDecoration: 'none',
    color: 'inherit',
    minWidth: 0,
  } as const;

  if (context.state === 'unavailable') {
    return (
      <div style={shell}>
        <span
          aria-hidden="true"
          style={{
            width: 46,
            height: 46,
            flex: '0 0 auto',
            borderRadius: 'var(--radius-card-inner)',
            background: 'var(--sable-100)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <Icon name="shield-alert" size={20} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', font: 'var(--type-label)', color: 'var(--text-heading)' }}>
            Annonce indisponible
          </span>
          <span style={{ display: 'block', font: 'var(--type-caption)', color: 'var(--text-body)' }}>
            Cette annonce n’est plus en ligne. La conversation reste accessible.
          </span>
        </span>
      </div>
    );
  }

  const { listing } = context;
  return (
    <Link href={`/listings/${listing.id}`} style={shell}>
      <span
        style={{
          width: 46,
          height: 46,
          flex: '0 0 auto',
          borderRadius: 'var(--radius-card-inner)',
          background: 'var(--sable-100)',
          overflow: 'hidden',
          display: 'block',
        }}
      >
        {listing.coverPhotoUrl ? (
          <img
            src={`${apiOrigin}${listing.coverPhotoUrl}`}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: 'var(--type-label)', color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {listing.title}
        </span>
        <span style={{ display: 'block', font: 'var(--type-caption)', color: 'var(--text-body)' }}>
          {rentPerMonth(listing.priceRent)} · {listing.city}
        </span>
      </span>

      <Icon name="chevron-right" size={18} color="var(--text-subtle)" />
    </Link>
  );
}
