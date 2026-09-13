'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';

import { Icon } from '@/components/ds/Icon';
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
 * structure (sticky, `--nav-h-desktop`, glass background, the `Wordmark`
 * treatment), and `ui_kits/mobile_app/AppShell.jsx`'s `TABS`/`TabBar` for
 * the mobile bottom bar — verbatim down to the icon choices and labels
 * ("Explorer", "Profil"). One deliberate content departure from
 * `SiteHeader`: its own nav is four marketing links (`Chambres`,
 * `Colocataires`, `Villes`, `Comment ça marche`) plus a "Se connecter" /
 * "Publier une annonce" pair — none of which are the gap this component
 * exists to close. Replaced with the actual requested set: a working quick
 * search, and links to the three sections that had no way back to them.
 * `AppShell.jsx`'s `TabBar` also carries an unread-message-count badge on
 * the Messages tab (`unread` prop) — not built here, since it needs its own
 * fetch on every single page for something outside what was asked for;
 * flagged in TODO.md as a follow-up rather than added unprompted.
 */

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

  if (FULL_SCREEN_ROUTES.some((pattern) => pattern.test(pathname))) return null;

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

  return (
    <header
      className="site-nav-desktop"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        height: 'var(--nav-h-desktop)',
        background: 'var(--surface-glass)',
        backdropFilter: 'var(--blur-glass)',
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
            style={linkStyle(pathname.startsWith('/messages'))}
          >
            <Icon name="message-circle" size={18} />
            Messages
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
  );
}
