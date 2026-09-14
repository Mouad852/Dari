'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useState, type CSSProperties } from 'react';

import { Icon } from '@/components/ds/Icon';
import { apiFetch } from '@/lib/api';
import { getIdToken } from '@/lib/firebase';
import { FULL_SCREEN_ROUTES } from '@/lib/fullScreenRoutes';

/**
 * Persistent site navigation — logo, quick search, and account/messages/
 * favourites shortcuts.
 *
 * Before this, the only way back to `/account`, `/messages` or `/favorites`
 * from anywhere else in the app was to already know the URL: no page linked
 * to any of them, `/account`'s own dashboard excepted, and that page was
 * itself only ever reached once, immediately after signing in. See the
 * account-dashboard stat-card fix and its TODO.md entry for the discovery.
 *
 * Ported from two design-system sources rather than invented from scratch:
 * `ui_kits/website/SiteChrome.jsx`'s `SiteHeader` for the desktop bar's
 * structure (sticky, `--nav-h-desktop`, the `Wordmark` treatment), and
 * `ui_kits/mobile_app/AppShell.jsx`'s `TABS`/`TabBar` for the mobile bottom
 * bar — verbatim down to the icon choices and labels ("Explorer", "Profil").
 * Three deliberate content departures from the sources: `SiteHeader`'s own
 * nav is four marketing links (`Chambres`, `Colocataires`, `Villes`,
 * `Comment ça marche`) plus a "Se connecter" / "Publier une annonce" pair —
 * none of which are the gap this component exists to close — replaced with
 * the actual requested set: a working quick search, and links to the three
 * sections that had no way back to them. `SiteHeader`'s glass background
 * (translucent + blur) was ported first, then swapped for a solid
 * `--surface-card` once tested against this app's own real content — see
 * the header's own style comment below for the contrast failure that
 * caused it. `TabBar` renders each tab as a `<button>` that flips local
 * component state, the right shape for the source's own single-screen
 * mobile-app mockup; this is a real multi-page site, so each tab is a real
 * `<Link>` instead, with `aria-current="page"` marking the active one the
 * same way the desktop header's links already do. `AppShell.jsx`'s `TabBar`
 * also carries an unread-message-count badge on the Messages tab (`unread`
 * prop) — not built here, since it needs its own fetch on every single
 * page for something outside what was asked for; flagged in TODO.md as a
 * follow-up rather than added unprompted. Now built: `useUnreadCount`
 * below fetches `GET /conversations/unread-count` (a new, single-number
 * endpoint -- the existing per-conversation `unreadCount` on
 * `ConversationResponse` would mean fetching the whole conversation list
 * just to sum a badge), polled every 30s while signed in and re-fetched on
 * every route change (leaving a thread just marked it read server-side via
 * that page's own `PATCH .../read`, and this component has no way to know
 * that happened except by asking again). Also added the same badge to the
 * desktop header's Messages link, which the source has no equivalent for --
 * a signed-in visitor should see their unread count regardless of
 * viewport, and `AppShell.jsx` simply has no desktop counterpart to
 * disagree with that.
 */

function useUnreadCount(signedIn: boolean | null, pathname: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!signedIn) {
      setCount(0);
      return;
    }

    let isCurrent = true;
    const refresh = async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const result = await apiFetch<{ unreadCount: number }>('/conversations/unread-count', { token });
        if (isCurrent) setCount(result.unreadCount);
      } catch {
        // A stale badge count for one cycle isn't worth surfacing an error for.
      }
    };

    void refresh();
    const interval = setInterval(refresh, 30000);
    return () => {
      isCurrent = false;
      clearInterval(interval);
    };
  }, [signedIn, pathname]);

  return count;
}

function unreadBadgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}

function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void getIdToken().then((token) => {
      if (isCurrent) setSignedIn(Boolean(token));
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  return signedIn;
}

function Wordmark() {
  return (
    <span
      style={{
        font: 'var(--weight-extra) 24px/1 var(--font-display)',
        letterSpacing: '-0.02em',
        color: 'var(--clay-600)',
      }}
    >
      dari
    </span>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const signedIn = useSignedIn();
  const unreadCount = useUnreadCount(signedIn, pathname);
  const isFullScreenRoute = FULL_SCREEN_ROUTES.some((pattern) => pattern.test(pathname));

  // The mobile bottom bar is `position: fixed`, so the page needs a matching
  // bottom-padding reservation -- applied here, not as a blanket CSS rule,
  // because a full-screen route (see below) renders no nav at all and a
  // plain `body { padding-bottom }` rule has no way to know that: it would
  // still reserve the space on `/messages/[id]`, whose `height: 100vh`
  // layout can't absorb it without the exact sliver-of-scroll problem this
  // whole exclusion exists to prevent.
  useEffect(() => {
    document.body.classList.toggle('has-site-nav', !isFullScreenRoute);
  }, [isFullScreenRoute]);

  if (isFullScreenRoute) return null;

  // null (auth still resolving -- usually one frame, while Firebase restores
  // a persisted session from IndexedDB) defaults to the signed-in
  // destination: /account already renders its own graceful "connectez-vous"
  // state for a signed-out visitor, so defaulting there avoids this link's
  // label and href visibly flipping a moment after paint.
  const accountHref = signedIn === false ? '/sign-in' : '/account';
  const accountLabel = signedIn === false ? 'Se connecter' : 'Mon compte';
  const accountActive = pathname.startsWith('/account');

  const linkStyle = (active: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: active ? 'var(--text-heading)' : 'var(--text-muted)',
    font: 'var(--weight-semibold) var(--type-body-sm) var(--font-ui)',
    textDecoration: 'none',
  });

  const mobileTabs = [
    { href: '/listings', icon: 'search', label: 'Explorer', active: pathname.startsWith('/listings'), badge: 0 },
    { href: '/favorites', icon: 'heart', label: 'Favoris', active: pathname === '/favorites', badge: 0 },
    { href: '/messages', icon: 'message-circle', label: 'Messages', active: pathname.startsWith('/messages'), badge: unreadCount },
    { href: accountHref, icon: 'user-round', label: 'Profil', active: accountActive, badge: 0 },
  ];

  return (
    <Fragment>
      <header
        className="site-nav-mobile-top"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          height: 'var(--nav-h-mobile)',
          // `display` lives in the class, not here: an inline `display` beats
          // the class's own `@media (min-width: 900px) { display: none }`
          // override, exactly the trap `.search-filters-toggle` already
          // documents elsewhere in app.css -- found live, the hard way, when
          // both this bar and the desktop header rendered at once at 1280px.
          alignItems: 'center',
          padding: '0 var(--gutter-mobile)',
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none' }}>
          <Wordmark />
        </Link>
      </header>

      <nav
        aria-label="Navigation principale"
        className="site-nav-mobile-bottom"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          // Same reasoning as the mobile top bar above -- `display` stays in
          // the class only.
          height: 'var(--tabbar-h)',
          background: 'var(--surface-card)',
          borderTop: '1px solid var(--border-hairline)',
          paddingBottom: 6,
        }}
      >
        {mobileTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? 'page' : undefined}
            aria-label={tab.badge > 0 ? `${tab.label}, ${tab.badge} non lu${tab.badge > 1 ? 's' : ''}` : undefined}
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              minHeight: 'var(--tap-min)',
              color: tab.active ? 'var(--brand)' : 'var(--text-subtle)',
              textDecoration: 'none',
            }}
          >
            <Icon name={tab.icon} size={22} />
            <span style={{ font: `var(--weight-${tab.active ? 'semibold' : 'medium'}) var(--text-micro)/1 var(--font-ui)` }}>
              {tab.label}
            </span>
            {tab.badge > 0 && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 'calc(50% - 18px)',
                  minWidth: 16,
                  height: 16,
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--brand)',
                  color: '#fff',
                  font: 'var(--weight-bold) 10px/16px var(--font-ui)',
                  textAlign: 'center',
                  padding: '0 4px',
                }}
              >
                {unreadBadgeLabel(tab.badge)}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <header
        className="site-nav-desktop"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          height: 'var(--nav-h-desktop)',
          // `SiteHeader.jsx`'s own glass treatment (`--surface-glass`,
          // 72%-opaque white + blur) was ported first, then replaced with a
          // solid surface after testing it against real scrolled content:
          // every other `--surface-glass` use in the app sits over an icon
          // (3:1) or a short badge on a fixed photo, never real body text.
          // This header's Messages/Favoris/Mon compte links are real text
          // (4.5:1), and this app's listing photos are uncontrolled,
          // real-brightness user uploads -- scrolling a dark one beneath a
          // sticky glass header measurably dropped the link text below AA
          // (verified live: an injected solid-black backdrop pulled the
          // composite to a mid-grey the existing text tokens were never
          // vetted against). A solid surface, already proven at 5.46:1+
          // everywhere else in the app, removes the dependency on what's
          // scrolling underneath entirely -- matching the mobile top bar
          // just above, which was already solid for the same reason.
          background: 'var(--surface-card)',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--container-max)',
            height: '100%',
            margin: '0 auto',
            padding: '0 var(--gutter-desktop)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-8)',
          }}
        >
          <Link href="/" style={{ textDecoration: 'none', flex: '0 0 auto' }}>
            <Wordmark />
          </Link>

          {/*
            A plain GET form to /listings, same uncontrolled pattern as the
            homepage's own hero search -- no client state, works with JS
            disabled, and stays correct if SearchResults.tsx's own param
            reading ever changes shape (it reads `neighborhood` from the URL
            directly, not from anything this form tracks).
          */}
          <form
            method="GET"
            action="/listings"
            role="search"
            style={{
              flex: '1 1 auto',
              maxWidth: 360,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 40,
              padding: '0 8px 0 14px',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--surface-card)',
            }}
          >
            <input
              type="search"
              name="neighborhood"
              placeholder="Rechercher un quartier…"
              aria-label="Rechercher un quartier"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                font: 'var(--type-body-sm)',
                color: 'var(--text-heading)',
              }}
            />
            <button
              type="submit"
              aria-label="Rechercher"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                flex: '0 0 auto',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--brand)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <Icon name="search" size={14} />
            </button>
          </form>

          <nav aria-label="Navigation principale" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', flex: '0 0 auto' }}>
            <Link
              href="/messages"
              aria-current={pathname.startsWith('/messages') ? 'page' : undefined}
              aria-label={unreadCount > 0 ? `Messages, ${unreadCount} non lu${unreadCount > 1 ? 's' : ''}` : undefined}
              style={linkStyle(pathname.startsWith('/messages'))}
            >
              <Icon name="message-circle" size={18} />
              Messages
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 16,
                    height: 16,
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--brand)',
                    color: '#fff',
                    font: 'var(--weight-bold) 10px/16px var(--font-ui)',
                    padding: '0 4px',
                  }}
                >
                  {unreadBadgeLabel(unreadCount)}
                </span>
              )}
            </Link>
            <Link
              href="/favorites"
              aria-current={pathname === '/favorites' ? 'page' : undefined}
              style={linkStyle(pathname === '/favorites')}
            >
              <Icon name="heart" size={18} />
              Favoris
            </Link>
            <Link
              href={accountHref}
              aria-current={accountActive ? 'page' : undefined}
              style={linkStyle(accountActive)}
            >
              <Icon name="user-round" size={18} />
              {accountLabel}
            </Link>
          </nav>
        </div>
      </header>
    </Fragment>
  );
}
