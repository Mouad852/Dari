'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, ChevronRight, CreditCard, Lock, LogOut, PencilLine, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiFetch, ApiError, type CursorPage } from '@/lib/api';
import { getIdToken, signOut } from '@/lib/firebase';
import { VERIFICATION_LABELS } from '@/lib/labels';
import type { ListingDetail, Me } from '@/types/api';

interface AccountStats {
  listings: number;
  listingsHasMore: boolean;
  conversations: number;
  conversationsHasMore: boolean;
  favorites: number;
}

const SECTIONS = [
  { label: 'Profil public', detail: 'Mettre à jour votre photo et votre bio', icon: UserRound, href: '/account/profile' },
  { label: 'Notifications', detail: 'Nouvelles réponses, visites et rappels', icon: Bell, href: '/account/notifications' },
  { label: 'Sécurité', detail: 'Mot de passe et vérification de compte', icon: Lock, href: '/account/security' },
  { label: 'Paiements', detail: 'Moyens de paiement et factures', icon: CreditCard, href: '/account/payments' },
] as const;

/**
 * What "complete" means here, replacing a hardcoded "85%" that was never
 * connected to anything. Five fields that make a profile more trustworthy to
 * a stranger deciding whether to reply -- a photo, a bio, a city, a phone
 * number, and a confirmed email -- each worth an equal fifth. Not a product
 * spec handed down elsewhere in the app; a defensible default computed from
 * fields `/users/me` already returns, same spirit as every other "stop
 * inventing numbers" fix this session.
 */
const PROFILE_COMPLETION_CHECKS: Array<{ label: string; met: (me: Me) => boolean }> = [
  { label: 'Photo de profil', met: (me) => Boolean(me.avatarUrl) },
  { label: 'Biographie', met: (me) => Boolean(me.bio && me.bio.trim().length > 0) },
  { label: 'Ville', met: (me) => Boolean(me.city) },
  { label: 'Téléphone', met: (me) => Boolean(me.phone) },
  { label: 'E-mail vérifié', met: (me) => me.emailVerified },
];

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Me | null>(null);
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function loadProfile() {
      const token = await getIdToken();
      if (!token) {
        if (isCurrent) setError('Connectez-vous pour accéder à votre compte.');
        return;
      }

      try {
        const result = await apiFetch<Me>('/users/me', { token });
        if (isCurrent) setProfile(result);
      } catch (cause) {
        if (isCurrent) {
          setError(cause instanceof ApiError && cause.isMissingProfile
            ? 'Votre profil Dari doit encore être créé.'
            : cause instanceof ApiError ? cause.message : 'Impossible de charger votre compte.');
        }
        return;
      }

      // Best-effort: a stat tile failing to load isn't worth blocking the page over.
      try {
        const [listings, conversations, favoriteIds] = await Promise.all([
          apiFetch<CursorPage<ListingDetail>>('/listings/mine', { token }),
          apiFetch<CursorPage<unknown>>('/conversations', { token }),
          apiFetch<string[]>('/favorites/ids', { token }),
        ]);
        if (isCurrent) {
          setStats({
            listings: listings.items.length,
            listingsHasMore: listings.hasMore,
            conversations: conversations.items.length,
            conversationsHasMore: conversations.hasMore,
            favorites: favoriteIds.length,
          });
        }
      } catch {
        // Stats stay null; the page renders fine without the row.
      }
    }

    void loadProfile();
    return () => {
      isCurrent = false;
    };
  }, []);

  const handleSignOut = () => {
    if (signingOut) return;
    setSigningOut(true);
    void signOut().then(() => router.push('/'));
  };

  if (error) {
    return (
      <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-muted)' }}>
        <h1 style={{ margin: 0, font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Votre compte</h1>
        <p role="alert">{error}</p>
        <Link href="/sign-in" style={{ color: 'var(--brand)' }}>Se connecter</Link>
      </main>
    );
  }

  if (!profile) {
    return <main style={{ minHeight: '100vh', padding: 'var(--space-8) var(--gutter-mobile)', color: 'var(--text-muted)' }}>Chargement de votre compte…</main>;
  }

  const completionMet = PROFILE_COMPLETION_CHECKS.filter((check) => check.met(profile)).length;
  const completionPercent = Math.round((completionMet / PROFILE_COMPLETION_CHECKS.length) * 100);

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
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Compte
            </div>
            <h1 style={{ margin: '0.35rem 0 0', font: 'var(--type-h2)', color: 'var(--text-heading)' }}>Votre profil</h1>
          </div>

          {/* Had no onClick at all -- editing a profile happens on /account/profile, which every other entry point on this page already links to. */}
          <Link
            href="/account/profile"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid var(--border-default)',
              background: 'var(--surface-card)',
              borderRadius: 'var(--radius-pill)',
              color: 'var(--text-heading)',
              padding: '0.65rem 0.9rem',
              font: 'var(--type-body-sm)',
              textDecoration: 'none',
            }}
          >
            Modifier
          </Link>
        </header>

        <section
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-xs)',
            padding: 'var(--space-5)',
            display: 'grid',
            gap: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <span
              style={{
                width: 72,
                height: 72,
                borderRadius: 'var(--radius-avatar)',
                background: 'linear-gradient(135deg, var(--clay-100), var(--sand-100))',
                color: 'var(--clay-700)',
                font: 'var(--weight-extra) 24px/1 var(--font-display)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {profile.displayName.charAt(0).toUpperCase()}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                <span style={{ font: 'var(--type-h3)', color: 'var(--text-heading)' }}>{profile.displayName}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    borderRadius: 'var(--radius-pill)',
                    background: profile.verification === 'NONE' ? 'var(--sable-100)' : 'var(--atlas-50)',
                    color: profile.verification === 'NONE' ? 'var(--text-muted)' : 'var(--atlas-700)',
                    padding: '0.3rem 0.55rem',
                    font: 'var(--type-label)',
                  }}
                >
                  <ShieldCheck size={12} />
                  {VERIFICATION_LABELS[profile.verification]}
                </span>
              </div>
              <div style={{ marginTop: 4, font: 'var(--type-body-sm)', color: 'var(--text-muted)' }}>
                {profile.email}{profile.city ? ` · ${profile.city}` : ''}
              </div>
            </div>
          </div>

          {/*
            Three plain, unlinked <div>s before this fix -- and, it turns
            out, the *only* place in the entire app that ever mentions
            /account/listings or /favorites at all: neither has a single
            other <Link> pointing at it anywhere, and /messages has just one
            (a thread's own "back" link, not an entry point from outside the
            messages section). With no persistent site nav either, these
            three stat cards were this app's sole intended gateway to a
            user's own listings, conversations and favourites -- styled and
            positioned exactly like a set of navigation cards, just missing
            the one thing that makes them navigate.
          */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
            {(stats ? [
              ['Annonces', `${stats.listings}${stats.listingsHasMore ? '+' : ''} annonce${stats.listings > 1 ? 's' : ''}`, '/account/listings'],
              ['Messages', `${stats.conversations}${stats.conversationsHasMore ? '+' : ''} conversation${stats.conversations > 1 ? 's' : ''}`, '/messages'],
              ['Favoris', `${stats.favorites} sauvegardé${stats.favorites > 1 ? 's' : ''}`, '/favorites'],
            ] as const : []
            ).map(([label, value, href]) => (
              <Link
                key={label}
                href={href}
                style={{
                  background: 'var(--sable-50)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-card-inner)',
                  padding: 'var(--space-3)',
                  display: 'grid',
                  gap: 4,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>{value}</span>
              </Link>
            ))}
          </div>
        </section>

        <section
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-xs)',
            padding: 'var(--space-4)',
            display: 'grid',
            gap: 'var(--space-2)',
          }}
        >
          {/*
            "Tout voir" had no onClick and nothing to reveal: SECTIONS below
            is 4 items and every one of them already renders, unsliced --
            there was never a truncated list behind it.
          */}
          <h2 style={{ margin: '0 0 6px', font: 'var(--type-h3)' }}>Paramètres</h2>

          {SECTIONS.map(({ label, detail, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                width: '100%',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-card-inner)',
                background: 'var(--surface-card)',
                color: 'inherit',
                padding: 'var(--space-3)',
                textAlign: 'left',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--brand-subtle)',
                  color: 'var(--clay-700)',
                }}
              >
                <Icon size={18} aria-hidden="true" />
              </span>

              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', font: 'var(--weight-semibold) var(--type-body) var(--font-ui)', color: 'var(--text-heading)' }}>{label}</span>
                <span style={{ display: 'block', marginTop: 2, font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{detail}</span>
              </span>

              <ChevronRight size={18} color="var(--text-subtle)" aria-hidden="true" />
            </Link>
          ))}
        </section>

        {/*
          Hidden once complete rather than showing "100% -- Compléter le
          profil", which would tell the visitor to do something there is
          nothing left to do.
        */}
        {completionPercent < 100 && (
          <section
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-xs)',
              padding: 'var(--space-4)',
              display: 'grid',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ font: 'var(--type-label)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Mise en avant
                </div>
                <div style={{ marginTop: 4, font: 'var(--type-h3)', color: 'var(--text-heading)' }}>Profil complet</div>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--sand-50)',
                  color: 'var(--sand-700)',
                  padding: '0.4rem 0.7rem',
                  font: 'var(--type-label)',
                }}
              >
                <Sparkles size={12} />
                {completionPercent}%
              </span>
            </div>

            <Link
              href="/account/profile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                border: 'none',
                background: 'var(--brand)',
                color: '#fff',
                borderRadius: 'var(--radius-pill)',
                padding: '0.95rem 1.2rem',
                font: 'var(--weight-semibold) var(--type-body) var(--font-ui)',
                boxShadow: 'var(--shadow-brand)',
                textDecoration: 'none',
              }}
            >
              <PencilLine size={16} />
              Compléter le profil
            </Link>
          </section>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            border: '1px solid var(--danger-border)',
            background: 'var(--surface-card)',
            color: 'var(--danger)',
            borderRadius: 'var(--radius-pill)',
            padding: '0.9rem 1rem',
            font: 'var(--weight-semibold) var(--type-body) var(--font-ui)',
            cursor: signingOut ? 'default' : 'pointer',
            opacity: signingOut ? 0.7 : 1,
          }}
        >
          <LogOut size={16} />
          {signingOut ? 'Déconnexion…' : 'Se déconnecter'}
        </button>
      </div>
    </main>
  );
}
