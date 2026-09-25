'use client';

import Link from 'next/link';
import { use, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ds/Button';
import { Icon } from '@/components/ds/Icon';
import { IconButton } from '@/components/ds/IconButton';
import { ErrorNotice, errorMessage } from '@/components/ErrorNotice';
import { apiFetch, ApiError, resolveMediaUrl, type CursorPage } from '@/lib/api';
import { ErrorCode } from '@/lib/errors';
import { getIdToken } from '@/lib/firebase';
import { clockTime, dayLabel, rentPerMonth } from '@/lib/format';
import { confirmPending, isPending, mergeMessages, newestFetched, PENDING_PREFIX, pollAnchor } from '@/lib/messages';
import type { Conversation, Me, Message, PublicListing } from '@/types/api';

/**
 * What the next render does to the message region's scroll: follow the thread
 * to its end, or keep the messages on screen where they are while older ones
 * are added above them.
 */
type ScrollPlan = { kind: 'bottom' } | { kind: 'keep'; height: number; top: number };

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

const MESSAGE_LIST = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-3)' } as const;

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [token, setToken] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [context, setContext] = useState<ListingContext>({ state: 'none' });
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<unknown>(null);
  // How many messages at the front came from "Voir les messages précédents".
  const [olderCount, setOlderCount] = useState(0);
  const [error, setError] = useState<unknown>(null);
  // Bumped by the error notice's retry, which is what re-runs the load effect.
  const [reloadKey, setReloadKey] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const composerRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const scrollPlanRef = useRef<ScrollPlan | null>(null);
  const atBottomRef = useRef(true);
  // Id → sentAt of every message the newest page and the polls *fetched*. Never
  // one this page just sent: see the poll.
  const fetchedRef = useRef(new Map<string, string>());
  const sendingRef = useRef(false);
  // A confirmed own message keeps its placeholder's key, so the live log does
  // not see a new item (and announce it again) when the server copy swaps in.
  const keyAliasRef = useRef(new Map<string, string>());

  // No route-change announcement exists anywhere in this app for a
  // client-side transition -- see the same fix on account/listings/page.tsx.
  // This page's heading only exists once the conversation has loaded (the
  // "Chargement de la conversation…" branch has no heading at all), so the
  // effect is keyed on `conversation` rather than firing once on mount.
  useEffect(() => {
    if (conversation) headingRef.current?.focus();
  }, [conversation]);

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
        // The newest page: the thread opens on its latest message.
        fetchedRef.current = new Map(page.items.map((message) => [message.id, message.sentAt]));
        scrollPlanRef.current = { kind: 'bottom' };
        setMessages(page.items);
        setOlderCount(0);
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
          // 403 keeps its own sentence: the server's "Accès refusé" says
          // nothing about which conversation the visitor tried to open.
          setError(cause instanceof ApiError && cause.status === 403
            ? 'Vous n’avez pas accès à cette conversation.'
            : cause);
        }
      }
    }

    void load();
    return () => {
      isCurrent = false;
    };
  }, [id, reloadKey]);

  /**
   * The thread's poll: new replies, and "Vu" under one's own last message.
   *
   * Nothing pushes to an open tab, so every 5 s while the tab is visible (and
   * at once when it becomes visible again) the page asks for messages `after=`
   * a message a minute behind the newest one it has fetched (`pollAnchor`),
   * then re-reads the conversation summary for the read receipt. A hidden tab
   * makes no requests. The overlap catches a message that committed after a
   * newer one was already fetched; only ids not fetched before count as new.
   *
   * The anchor is only ever a message that came from a GET, never one this page
   * just sent: a reply written a moment before one's own message is newer than
   * the anchor, so it still arrives. No poll starts while a send is in flight;
   * one already running can still bring the sent message back before the POST
   * answers, and it then shows next to the placeholder until the send confirms
   * and the merge by id keeps one.
   *
   * Each cycle asks Firebase for the current token (cached, refreshed near
   * expiry) rather than reusing the one from opening the page, which after an
   * hour would turn every poll into a rejected request and a replay.
   */
  useEffect(() => {
    if (!token || !myId) return;
    let isCurrent = true;
    let polling = false;
    const threadPath = `/conversations/${encodeURIComponent(id)}`;

    const fetchNewer = async (token: string) => {
      const fetched = fetchedRef.current;
      let anchor = pollAnchor(fetched);
      let continueFrom = newestFetched(fetched);
      // Bounded: each round is one page at most.
      for (let round = 0; round < 5; round += 1) {
        const requestedAfter = anchor;
        let page: CursorPage<Message>;
        try {
          page = await apiFetch<CursorPage<Message>>(
            `${threadPath}/messages${requestedAfter ? `?after=${encodeURIComponent(requestedAfter)}` : ''}`,
            { token },
          );
        } catch (cause) {
          // The anchor is no longer a visible message: start over from the newest page.
          if (requestedAfter && cause instanceof ApiError && cause.code === ErrorCode.INVALID_CURSOR) {
            anchor = null;
            continueFrom = null;
            continue;
          }
          throw cause;
        }
        if (!isCurrent) return;
        const added = page.items.filter((message) => !fetched.has(message.id));
        for (const message of page.items) fetched.set(message.id, message.sentAt);
        if (page.items.length > 0) {
          setMessages((prev) => mergeMessages(prev ?? [], page.items, 'newer'));
        }
        if (added.length > 0) {
          // Follow the thread only for a reader already at its end.
          if (atBottomRef.current) scrollPlanRef.current = { kind: 'bottom' };
          // Seen on an open, visible thread: read, as on opening it.
          if (added.some((message) => message.senderId !== myId)) {
            void apiFetch(`${threadPath}/read`, { method: 'PATCH', token }).catch(() => {});
          }
        }
        if (!requestedAfter) {
          // The newest page, whose hasMore means *older*. If it reaches back to
          // a message already fetched, nothing is missing; otherwise go on from
          // the newest one fetched before.
          if (!page.hasMore || added.length < page.items.length || !continueFrom) return;
          anchor = continueFrom;
          continueFrom = null;
          continue;
        }
        const last = page.items.at(-1);
        if (!page.hasMore || !last) return;
        anchor = last.id;
      }
    };

    const poll = async () => {
      if (polling || sendingRef.current || document.visibilityState !== 'visible') return;
      polling = true;
      try {
        const current = (await getIdToken().catch(() => null)) ?? token;
        await fetchNewer(current);
        const fresh = await apiFetch<Conversation>(threadPath, { token: current });
        if (!isCurrent) return;
        if (fresh.lastMessageId && fresh.lastMessageReadAt) {
          setMessages((prev) =>
            (prev ?? []).map((message) =>
              message.id === fresh.lastMessageId && message.readAt !== fresh.lastMessageReadAt
                ? { ...message, readAt: fresh.lastMessageReadAt }
                : message,
            ),
          );
        }
      } catch {
        // A missed refresh cycle isn't worth surfacing an error for; the next
        // poll a few seconds later tries again.
      } finally {
        polling = false;
      }
    };

    const interval = setInterval(() => void poll(), 5000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      isCurrent = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [token, myId, id]);

  /**
   * Applies the scroll plan the last change asked for, before paint.
   *
   * Opening lands on the newest message; sending, or a reply arriving while the
   * reader is at the end, follows the thread down; a reply arriving while they
   * are reading further up leaves them where they are; older messages added
   * above keep the visible ones in place.
   *
   * `auto` on the first scroll so there is no visible animation on load. The
   * later `smooth` is checked against prefers-reduced-motion by hand, because
   * the CSS rule in app.css (`scroll-behavior: auto !important` under the media
   * query) does not reach it: that property only governs a scroll that defers
   * to CSS, and an explicit `behavior: 'smooth'` in the API call is a direct
   * request the browser honours regardless of the stylesheet.
   */
  const hasScrolled = useRef(false);
  useLayoutEffect(() => {
    const region = scrollRegionRef.current;
    const plan = scrollPlanRef.current;
    if (!region || !plan) return;
    scrollPlanRef.current = null;
    if (plan.kind === 'keep') {
      region.scrollTop = plan.top + (region.scrollHeight - plan.height);
      return;
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    region.scrollTo({ top: region.scrollHeight, behavior: hasScrolled.current && !reducedMotion ? 'smooth' : 'auto' });
    hasScrolled.current = true;
    atBottomRef.current = true;
  }, [messages]);

  /**
   * A reader at the end stays at the end when the region itself changes size:
   * the listing card arrives after the first scroll and pushes the header down,
   * which hid the newest message on opening. Only the region's own box is
   * observed, so older messages added above never trigger this.
   */
  useEffect(() => {
    const region = scrollRegionRef.current;
    if (!region || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) region.scrollTop = region.scrollHeight;
    });
    observer.observe(region);
    return () => observer.disconnect();
  }, [conversation]);

  const onThreadScroll = () => {
    const region = scrollRegionRef.current;
    if (region) atBottomRef.current = region.scrollHeight - region.scrollTop - region.clientHeight < 48;
  };

  /**
   * Same `disabled={<async state>}` focus loss as the composer below, this
   * time on "Voir les messages précédents" (`loading={loadingMore}` on the
   * shared `Button`, which doesn't forward refs -- so this captures
   * `document.activeElement` instead of holding a ref to the button
   * itself, same technique as the publish wizard's photo buttons). Falls
   * back to the thread header's `<h1>` when the captured element is gone
   * -- true once this load reaches the last page and the button itself
   * unmounts (`{nextCursor ? <Button>… : null}`).
   */
  const lastFocusedBeforeLoadMoreRef = useRef<HTMLElement | null>(null);
  const armLoadMoreRefocus = () => {
    const active = document.activeElement;
    lastFocusedBeforeLoadMoreRef.current = active instanceof HTMLElement ? active : null;
  };
  useEffect(() => {
    if (!loadingMore && lastFocusedBeforeLoadMoreRef.current) {
      const el = lastFocusedBeforeLoadMoreRef.current;
      lastFocusedBeforeLoadMoreRef.current = null;
      const usable = el.isConnected && !(el instanceof HTMLButtonElement && el.disabled);
      // preventScroll: a plain focus() scrolled the button back into view and
      // undid the kept reading position from the scroll plan above.
      (usable ? el : headingRef.current)?.focus({ preventScroll: true });
    }
  }, [loadingMore]);

  const handleLoadMore = () => {
    if (!nextCursor || !token || loadingMore) return;
    armLoadMoreRefocus();
    setLoadingMore(true);
    setLoadMoreError(null);
    void (async () => {
      try {
        const page = await apiFetch<CursorPage<Message>>(
          `/conversations/${encodeURIComponent(id)}/messages?cursor=${encodeURIComponent(nextCursor)}`,
          { token },
        );
        const region = scrollRegionRef.current;
        if (region) scrollPlanRef.current = { kind: 'keep', height: region.scrollHeight, top: region.scrollTop };
        const known = new Set((messages ?? []).map((message) => message.id));
        setOlderCount((count) => count + page.items.filter((message) => !known.has(message.id)).length);
        setMessages((prev) => mergeMessages(prev ?? [], page.items, 'older'));
        setNextCursor(page.nextCursor);
      } catch (cause) {
        // Beside the button, not the page-level error: that one replaces the
        // whole thread, which is still perfectly readable.
        setLoadMoreError(cause);
      } finally {
        setLoadingMore(false);
      }
    })();
  };

  /**
   * Sending disables the composer input and its button (see `disabled={sending}`
   * / `loading={sending}` below), and a browser blurs whatever control it just
   * disabled. That dropped focus to `<body>` on every message sent — a keyboard
   * user typing several messages in a row had to click back into the field each
   * time. `shouldRefocusRef` is armed only for a submit that actually started
   * sending, so a load triggered by something else never steals focus.
   */
  const shouldRefocusRef = useRef(false);
  useEffect(() => {
    if (!sending && shouldRefocusRef.current) {
      shouldRefocusRef.current = false;
      composerRef.current?.focus();
    }
  }, [sending]);

  /**
   * Optimistic sending: the bubble appears the instant `Envoyer` is pressed,
   * not once the server confirms it. `pendingId` is generated client-side
   * (`crypto.randomUUID()`, the same pattern the publish wizard already uses
   * for its own client-only keys) and prefixed so it can never collide with
   * a real server id; the placeholder message carries it in place of `id`
   * until the real response swaps it in. A failed send removes the
   * placeholder and restores the typed text to the composer rather than
   * discarding it -- the whole point of showing the message immediately is
   * trust that it went through, so a silent failure that just made the
   * bubble vanish with no way to recover the text would be worse than the
   * synchronous send this replaces.
   */
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value || !token || sending || !myId) return;

    const pendingId = `${PENDING_PREFIX}${crypto.randomUUID()}`;
    const optimisticMessage: Message = {
      id: pendingId,
      conversationId: id,
      senderId: myId,
      body: value,
      sentAt: new Date().toISOString(),
      readAt: null,
    };

    shouldRefocusRef.current = true;
    scrollPlanRef.current = { kind: 'bottom' };
    setMessages((prev) => [...(prev ?? []), optimisticMessage]);
    setDraft('');
    setSending(true);
    sendingRef.current = true;
    setSendError(null);
    void (async () => {
      try {
        const sent = await apiFetch<Message>(`/conversations/${encodeURIComponent(id)}/messages`, {
          method: 'POST',
          token,
          body: { body: value },
        });
        keyAliasRef.current.set(sent.id, pendingId);
        setMessages((prev) => confirmPending(prev ?? [], pendingId, sent));
      } catch (cause) {
        setMessages((prev) => (prev ?? []).filter((message) => message.id !== pendingId));
        setDraft(value);
        // A distinct state from the page-level `error` above on purpose: that
        // one drives the full-page early return a few lines down, so reusing
        // it here replaced the entire thread -- header, history, composer --
        // with a bare "Retour aux messages" screen on every failed send,
        // discarding a still-perfectly-loaded conversation over one message
        // that didn't go through.
        setSendError(errorMessage(cause, 'Le message n’a pas pu être envoyé.'));
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    })();
  };

  if (error) {
    return (
      <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', display: 'grid', gap: 'var(--space-4)', justifyItems: 'start', alignContent: 'start' }}>
        <ErrorNotice
          error={error}
          fallback="Impossible de charger cette conversation."
          onRetry={typeof error === 'string' ? undefined : () => {
            setError(null);
            setReloadKey((key) => key + 1);
          }}
        >
          <Link href={token ? '/messages' : '/sign-in'} style={{ textDecoration: 'none' }}>
            <Button variant="secondary" iconLeft={token ? 'arrow-left' : undefined}>
              {token ? 'Retour aux messages' : 'Se connecter'}
            </Button>
          </Link>
        </ErrorNotice>
      </main>
    );
  }

  if (!conversation || !messages || !myId) {
    return (
      <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-body)' }}>
        <p role="status" style={{ margin: 0 }}>Chargement de la conversation…</p>
      </main>
    );
  }

  // Shared by the list of loaded older pages and the live log below, with
  // indexes into the whole thread so separators and the receipt stay right.
  const renderMessage = (message: Message, index: number) => {
    const mine = message.senderId === myId;
    const sentAt = new Date(message.sentAt);
    const previous = messages[index - 1];
    // A separator whenever the calendar day changes, so a thread read top
    // to bottom shows when the gaps were.
    const newDay = !previous || new Date(previous.sentAt).toDateString() !== sentAt.toDateString();
    // The optimistic placeholder from `onSubmit` -- never a real
    // server id, which is always a UUID with no prefix.
    const pending = isPending(message);
    // Only the trailing edge of the thread, the same convention
    // every messaging app uses: a receipt on an older message the
    // other participant has since replied past would just be noise.
    const showReadReceipt = mine && !pending && index === messages.length - 1 && Boolean(message.readAt);

    return (
      <li key={keyAliasRef.current.get(message.id) ?? message.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-3)' }}>
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
            // Longhand, not the `font` shorthand -- see ReportDialog.tsx for why.
            fontWeight: 'var(--weight-regular)',
            fontSize: 'var(--text-body-md)',
            fontFamily: 'var(--font-ui)',
            lineHeight: 1.5,
            overflowWrap: 'anywhere',
            // The one visual cue that a bubble is the optimistic
            // placeholder rather than a confirmed send -- gone the
            // instant the real response swaps it in, or the whole
            // bubble is gone if the send failed.
            opacity: pending ? 0.6 : 1,
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
        {showReadReceipt && (
          <span
            style={{
              justifySelf: 'end',
              marginTop: -8,
              font: 'var(--type-caption)',
              color: 'var(--text-muted)',
            }}
          >
            Vu
          </span>
        )}
      </li>
    );
  };

  return (
    <main
      style={{
        // Bounded, not `minHeight`: the three children below are a fixed
        // header band, a `flex: 1; overflowY: auto` message region, and a
        // composer meant to stay pinned at the bottom. With only a minimum,
        // `main` simply grew past the viewport once a thread had enough
        // messages, and it was the *document* that ended up scrolling instead
        // of the middle region — which took the composer down with it,
        // scrolled away behind the page's own footer. A capped height is what
        // makes the middle child's own scroll region the one that activates.
        height: '100vh',
        background: 'linear-gradient(180deg, var(--bg-page) 0%, var(--sable-50) 100%)',
        color: 'var(--text-heading)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/*
        The header and the listing-context card stick together as one unit.
        `main` only sets a `minHeight`, not a bounded `height`, so it grows
        past the viewport and it is the *document* that scrolls, not the
        inner `overflowY: auto` region below — a sticky child only stays put
        against whatever actually scrolls it. Putting `position: sticky` on
        this shared wrapper, once, keeps both bands correct together instead
        of computing the header's pixel height to offset a second sticky
        element (which would silently drift out of sync the next time the
        header's own padding or content changes).
      */}
      <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-page)' }}>
        <header
          style={{
            padding: 'var(--space-4) var(--gutter-mobile)',
            borderBottom: '1px solid var(--border-hairline)',
            background: 'var(--surface-card)',
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
          <h1 ref={headingRef} tabIndex={-1} style={{ margin: 0, flex: 1, minWidth: 0, font: 'var(--type-label)', color: 'var(--text-heading)' }}>
            {conversation.otherUserDisplayName}
          </h1>
          </div>
        </header>

        {/*
          A reader following a long thread should not have to scroll back to
          the top to re-check whether the room they are discussing is still
          listed.
        */}
        {(context.state === 'ok' || context.state === 'unavailable') && (
          <div style={{ padding: 'var(--space-5) var(--gutter-mobile) 0' }}>
            <div style={THREAD_COLUMN}>
              <ListingContextCard context={context} />
            </div>
          </div>
        )}
      </div>

      <div
        ref={scrollRegionRef}
        onScroll={onThreadScroll}
        style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5) var(--gutter-mobile)' }}
      >
        <div
          style={{
            ...THREAD_COLUMN,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 'var(--space-4)',
            alignContent: 'start',
          }}
        >
        {/*
          Above the list: the thread opens on its newest page, and the cursor
          leads to older messages, which are added on top.
        */}
        {nextCursor ? (
          <Button variant="secondary" size="sm" loading={loadingMore} onClick={handleLoadMore} style={{ justifySelf: 'center' }}>
            {loadingMore ? 'Chargement…' : 'Voir les messages précédents'}
          </Button>
        ) : null}
        {loadMoreError ? (
          <p role="alert" style={{ margin: 0, justifySelf: 'center', color: 'var(--danger)', font: 'var(--type-body-sm)' }}>
            {errorMessage(loadMoreError, 'Impossible de charger les messages précédents.')}
          </p>
        ) : null}

        {/*
          Older pages loaded on request sit in a plain list above the live
          region: 20 messages the reader asked for are not read out.
        */}
        {olderCount > 0 ? (
          <ol aria-label="Messages précédents" style={MESSAGE_LIST}>
            {messages.slice(0, olderCount).map((message, index) => renderMessage(message, index))}
          </ol>
        ) : null}

        {/*
          role="log" + aria-live="polite": a message added to this list is
          announced on its own, and the thread already on screen is not read
          out again. The app had no live region at all, so a message arriving
          in an open thread was completely silent.
        */}
        <ol
          role="log"
          aria-live="polite"
          aria-label="Messages de la conversation"
          style={MESSAGE_LIST}
        >
          {messages.slice(olderCount).map((message, offset) => renderMessage(message, olderCount + offset))}
        </ol>
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
        {sendError ? (
          <p
            role="alert"
            style={{ ...THREAD_COLUMN, margin: '0 0 var(--space-2)', color: 'var(--danger)', font: 'var(--type-body-sm)' }}
          >
            {sendError}
          </p>
        ) : null}
        <div style={{ ...THREAD_COLUMN, display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        {/*
          A bare input rather than the design system's Input: this one is a pill
          in a composer bar, not a labelled form field, and Input's label block
          and helper row are the wrong shape here. The border, radius and focus
          treatment still come from the same tokens.
        */}
        <input
          ref={composerRef}
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
            src={resolveMediaUrl(listing.coverPhotoUrl)}
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
