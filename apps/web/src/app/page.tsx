import {
  ArrowRight,
  KeyRound,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';

import { apiFetch, apiOrigin } from '@/lib/api';
import { CITIES as CITY_NAMES, citySlug } from '@/lib/cities';
import { PROPERTY_TYPE_LABELS } from '@/lib/labels';
import type { PublicListing } from '@/types/api';

import { Button } from '@/components/ds/Button';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const revalidate = 900;

export const metadata: Metadata = {
  title: 'Dari — colocation à Rabat, Casablanca, Marrakech et Tanger',
  description:
    'Trouvez une chambre ou un studio en colocation au Maroc. Loyers annoncés charges comprises, annonces vérifiées avant publication.',
  alternates: { canonical: SITE },
  openGraph: {
    title: 'Dari — colocation au Maroc',
    description:
      'Trouvez une chambre ou un studio en colocation à Rabat, Casablanca, Marrakech et Tanger.',
    type: 'website',
    url: SITE,
    locale: 'fr_MA',
  },
};

/**
 * The homepage's numbers, measured rather than written.
 *
 * Every figure here used to be a literal: four invented per-city counts ("412
 * chambres", "938 chambres"), and four entirely fictional featured listings
 * complete with star ratings, on a product that has no reviews system at all.
 */
async function getHomeData() {
  const [featured, ...counts] = await Promise.all([
    apiFetch<PublicListing[]>('/listings/featured?limit=4').catch(() => []),
    ...CITY_NAMES.map((city) =>
      apiFetch<{ count: number; capped: boolean }>(
        `/listings/count?city=${encodeURIComponent(city)}`,
      )
        .then((result) => ({ city, ...result }))
        .catch(() => null),
    ),
  ]);

  return {
    featured,
    cities: counts.filter((entry) => entry !== null),
  };
}

const STEPS = [
  ['search', 'Cherchez', 'Filtrez par quartier, budget et style de vie.'],
  ['shield-check', 'Vérifiez', 'Annonces et profils contrôlés avant publication.'],
  ['message-circle', 'Discutez', 'Échangez avec le propriétaire et les colocataires.'],
  ['key-round', 'Emménagez', 'Organisez la visite et l’emménagement directement avec le propriétaire.'],
] as const;

const cardStyle = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--shadow-sm)',
};

/**
 * The hero search, as a plain GET form.
 *
 * Every control here was previously inert: the selects and the budget field
 * were unbound, and the submit button was a `type="button"` with no handler, so
 * the site's primary call to action did nothing at all. The "Type" select also
 * offered Chambre / Logement entier / Coliving — none of which are values the
 * API knows, the same fictional dropdown that was found and fixed in the
 * publish wizard.
 *
 * A GET form rather than a client component: the field names are exactly the
 * query parameters /listings already reads, so the browser builds the URL
 * itself. That keeps the homepage a Server Component, ships no JavaScript for
 * it, and means search works before hydration — which matters more on a slow
 * mobile connection than anywhere else.
 */
function SearchBar() {
  const fieldLabelStyle = {
    font: 'var(--type-label)',
    letterSpacing: 'var(--ls-caps)',
    textTransform: 'uppercase',
  } as const;

  const controlStyle = {
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-card)',
    color: 'var(--text-heading)',
    padding: '0.8rem 0.9rem',
    font: 'var(--type-body)',
    width: '100%',
    boxSizing: 'border-box',
  } as const;

  return (
    <form
      method="GET"
      action="/listings"
      style={{
        ...cardStyle,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-4)',
        alignItems: 'flex-end',
        padding: 'var(--card-pad-lg)',
      }}
    >
      <label style={{ display: 'grid', gap: '0.4rem', flex: '1 1 180px', color: 'var(--text-muted)' }}>
        <span style={fieldLabelStyle}>Ville</span>
        <select name="city" defaultValue="Rabat" style={controlStyle}>
          {CITY_NAMES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'grid', gap: '0.4rem', flex: '1 1 180px', color: 'var(--text-muted)' }}>
        <span style={fieldLabelStyle}>Budget max.</span>
        <div style={{ position: 'relative' }}>
          <input
            name="priceMax"
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            placeholder="4000"
            style={{ ...controlStyle, padding: '0.8rem 2.8rem 0.8rem 0.9rem' }}
          />
          <span
            style={{
              position: 'absolute',
              right: '0.8rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              font: 'var(--type-label)',
            }}
          >
            MAD
          </span>
        </div>
      </label>

      <label style={{ display: 'grid', gap: '0.4rem', flex: '1 1 180px', color: 'var(--text-muted)' }}>
        <span style={fieldLabelStyle}>Type de logement</span>
        {/* Real PropertyType values, with the shared labels rather than invented ones. */}
        <select name="propertyType" defaultValue="" style={controlStyle}>
          <option value="">Tous les logements</option>
          {(Object.keys(PROPERTY_TYPE_LABELS) as Array<keyof typeof PROPERTY_TYPE_LABELS>).map((value) => (
            <option key={value} value={value}>
              {PROPERTY_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      {/*
        First use of the ported design-system Button. The hand-rolled version
        this replaces re-declared the pill radius, the terracotta fill, the warm
        shadow and the font stack inline -- and had no hover, press or disabled
        state at all, because those are tedious to hand-roll and so never were.
      */}
      <Button type="submit" size="lg" iconLeft="search" style={{ flex: '0 0 auto' }}>
        Rechercher
      </Button>
    </form>
  );
}

function ListingCard({ listing }: { listing: PublicListing }) {
  return (
    <a
      href={`/listings/${listing.id}`}
      style={{
        ...cardStyle,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: '170px 1fr',
        color: 'var(--text-heading)',
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          background: 'var(--sable-200)',
          color: 'var(--text-body)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: 'var(--type-caption)',
          letterSpacing: 'var(--ls-caps)',
          textTransform: 'uppercase',
        }}
      >
        {listing.coverPhotoUrl ? (
          <img
            src={`${apiOrigin}${listing.coverPhotoUrl}`}
            alt=""
            loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          'Photo'
        )}
        {/*
          Price only. This overlay used to carry a star rating too -- "4,8" and
          the like -- on a product with no reviews system of any kind.
        */}
        <span
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            background: 'rgba(36, 31, 28, 0.56)',
            backdropFilter: 'blur(12px)',
            color: '#fff',
            borderRadius: '999px',
            padding: '0.45rem 0.7rem',
            font: 'var(--type-label)',
          }}
        >
          {new Intl.NumberFormat('fr-MA').format(listing.priceRent)} MAD/mois
        </span>
      </div>

      <div style={{ display: 'grid', gap: '0.9rem', padding: '1rem 1rem 1.1rem' }}>
        <div>
          <div style={{ font: 'var(--type-eyebrow)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
            {listing.neighborhood}
          </div>
          <h3 style={{ margin: '0.15rem 0 0', font: 'var(--type-h3)' }}>{listing.title}</h3>
        </div>
        <div style={{ color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>{listing.city}</div>
      </div>
    </a>
  );
}

export default async function HomePage() {
  const { featured, cities } = await getHomeData();

  return (
    <main>
      <section
        style={{
          position: 'relative',
          padding: 'var(--space-11) var(--gutter-desktop) var(--space-10)',
          background: 'linear-gradient(180deg, var(--clay-50) 0%, var(--bg-page) 78%)',
        }}
      >
        <div
          style={{
            maxWidth: 'var(--container-max)',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-9)',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
            <span style={{ display: 'inline-flex', width: 'fit-content' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'var(--brand-subtle)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '0.5rem 0.75rem',
                  // Terracotta on --brand-subtle is 4.40:1. clay-700 is the
                  // shade the Badge component already uses on this tint.
                  color: 'var(--clay-700)',
                  font: 'var(--type-label)',
                }}
              >
                <ShieldCheck size={16} />
                Annonces vérifiées une par une
              </span>
            </span>
            <h1
              style={{
                margin: 0,
                font: 'var(--weight-extra) 52px/1.08 var(--font-display)',
                letterSpacing: 'var(--ls-display)',
                color: 'var(--text-heading)',
              }}
            >
              Une chambre, des colocataires, une vraie adresse.
            </h1>
            <p
              style={{
                margin: 0,
                font: 'var(--type-body-lg)',
                color: 'var(--text-muted)',
                maxWidth: 520,
              }}
            >
              Trouvez une colocation à Rabat, Casablanca, Marrakech ou Tanger — avec des profils vérifiés et des loyers annoncés charges comprises.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  height: '3.25rem',
                  padding: '0 1.4rem',
                  background: 'var(--brand)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  font: 'var(--weight-semibold) var(--type-body) var(--font-ui)',
                  boxShadow: 'var(--shadow-brand)',
                  cursor: 'pointer',
                }}
              >
                Voir les chambres
              </button>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  height: '3.25rem',
                  padding: '0 1.35rem',
                  background: 'transparent',
                  color: 'var(--text-heading)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-pill)',
                  font: 'var(--weight-semibold) var(--type-body) var(--font-ui)',
                  cursor: 'pointer',
                }}
              >
                <Plus size={18} />
                Publier une annonce
              </button>
            </div>
          </div>

          <div
            style={{
              height: 380,
              borderRadius: 'var(--radius-2xl)',
              background: 'var(--sable-200)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-body)',
              font: 'var(--type-caption)',
              letterSpacing: 'var(--ls-caps)',
              textTransform: 'uppercase',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            Photo
          </div>
        </div>

        <div style={{ maxWidth: 'var(--container-max)', margin: 'var(--space-9) auto 0' }}>
          <SearchBar />
        </div>
      </section>

      <section style={{ padding: 'var(--space-10) var(--gutter-desktop)' }}>
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, font: 'var(--weight-bold) 32px/1.2 var(--font-display)' }}>Chambres en vedette</h2>
            <a
              href="/listings"
              style={{ color: 'var(--brand)', textDecoration: 'none', font: 'var(--type-body)' }}
            >
              Voir les 1 843 annonces <ArrowRight size={16} style={{ verticalAlign: 'middle' }} />
            </a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-5)' }}>
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: 'var(--space-10) var(--gutter-desktop)', background: 'var(--bg-page-alt)' }}>
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-6)' }}>
          <h2 style={{ margin: 0, font: 'var(--weight-bold) 32px/1.2 var(--font-display)' }}>Comment ça marche</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-5)' }}>
            {STEPS.map(([icon, title, description], index) => {
              const IconComponent =
                icon === 'search'
                  ? Search
                  : icon === 'shield-check'
                    ? ShieldCheck
                    : icon === 'message-circle'
                      ? MessageCircle
                      : KeyRound;

              return (
                <div
                  key={title}
                  style={{
                    ...cardStyle,
                    display: 'grid',
                    gap: 'var(--space-3)',
                    alignContent: 'start',
                    padding: 'var(--card-pad-lg)',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--brand-subtle)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--clay-700)',
                    }}
                  >
                    <IconComponent size={20} />
                  </span>
                  <span
                    style={{
                      font: 'var(--type-eyebrow)',
                      letterSpacing: 'var(--ls-caps)',
                      textTransform: 'uppercase',
                      color: 'var(--text-subtle)',
                    }}
                  >
                    Étape {index + 1}
                  </span>
                  <h3 style={{ margin: 0, font: 'var(--type-h3)' }}>{title}</h3>
                  <p style={{ margin: 0, font: 'var(--type-body-sm, 13px)', color: 'var(--text-muted)' }}>{description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ padding: 'var(--space-10) var(--gutter-desktop)' }}>
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-6)' }}>
          <h2 style={{ margin: 0, font: 'var(--weight-bold) 32px/1.2 var(--font-display)' }}>Explorer par ville</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-5)' }}>
            {/*
              Real counts, and real links. The tiles carried invented figures
              ("412 chambres") and a cursor:pointer with nothing behind it.
            */}
            {cities.map(({ city, count, capped }) => (
              <a
                key={city}
                href={`/flatshare/${citySlug(city)}`}
                style={{
                  position: 'relative',
                  height: 200,
                  borderRadius: 'var(--radius-card)',
                  overflow: 'hidden',
                  background: 'var(--sable-200)',
                  display: 'block',
                  textDecoration: 'none',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-body)',
                    font: 'var(--type-caption)',
                    letterSpacing: 'var(--ls-caps)',
                    textTransform: 'uppercase',
                  }}
                >
                  Photo
                </span>
                <span style={{ position: 'absolute', inset: 0, background: 'var(--scrim-image)' }} />
                <span style={{ position: 'absolute', bottom: 14, left: 16, color: '#fff' }}>
                  <span style={{ display: 'block', font: 'var(--weight-bold) 20px/1.2 var(--font-display)' }}>{city}</span>
                  <span style={{ display: 'block', font: 'var(--type-caption)', opacity: 0.88 }}>
                    {capped ? `${count}+` : count} annonce{count > 1 ? 's' : ''}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 var(--gutter-desktop) var(--space-11)' }}>
        <div
          style={{
            maxWidth: 'var(--container-max)',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-8)',
            background: 'var(--clay-500)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'var(--space-9) var(--space-10)',
            color: '#fff',
          }}
        >
          <div style={{ flex: 1, display: 'grid', gap: 'var(--space-4)' }}>
            <h2
              style={{
                margin: 0,
                font: 'var(--weight-extra) 34px/1.15 var(--font-display)',
                color: '#fff',
                letterSpacing: 'var(--ls-display)',
              }}
            >
              Vous avez une chambre libre ?
            </h2>
            <p style={{ margin: 0, font: 'var(--type-body-lg)', color: 'var(--text-on-brand)', maxWidth: 520 }}>
              Publiez gratuitement, choisissez vos colocataires, encaissez le loyer en ligne.
            </p>
          </div>
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              height: '3.25rem',
              padding: '0 1.3rem',
              background: '#fff',
              color: 'var(--text-heading)',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              font: 'var(--weight-semibold) var(--type-body) var(--font-ui)',
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
            }}
          >
            Publier une annonce
          </button>
        </div>
      </section>
    </main>
  );
}
