import { ArrowRight, MapPin, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ListingCard } from '@/components/ds/ListingCard';
import { amount } from '@/lib/format';
import { apiFetch, apiOrigin, type CursorPage } from '@/lib/api';
import type { PublicListing } from '@/types/api';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const CITY_LABELS: Record<string, string> = {
  rabat: 'Rabat',
  casablanca: 'Casablanca',
  marrakech: 'Marrakech',
  tanger: 'Tanger',
};

/** The four cities are the product's scope, so the routes are known ahead of time. */
export function generateStaticParams() {
  return Object.keys(CITY_LABELS).map((city) => ({ city }));
}

export const revalidate = 900;

type CityData = {
  cityName: string;
  listings: PublicListing[];
  count: { count: number; capped: boolean } | null;
  priceRange: { min: number; max: number } | null;
  neighborhoods: string[];
};

/**
 * Everything this page states about a city, read from the API.
 *
 * The page previously published invented figures — "420 annonces actives",
 * "2 600 MAD budget moyen", "6 jours temps moyen de réponse" — and Rabat's
 * neighbourhoods on all four city pages. On a page whose whole purpose is to be
 * indexed and read by people deciding where to live, that is the worst possible
 * place for numbers nobody measured.
 */
async function getCityData(slug: string): Promise<CityData | null> {
  const cityName = CITY_LABELS[slug.toLowerCase()];
  if (!cityName) return null;

  const city = encodeURIComponent(cityName);

  // Cheapest honest price range: the first row of each price ordering. Two
  // small requests rather than averaging a page and calling it a market rate.
  const [listingsPage, count, cheapest, dearest] = await Promise.all([
    apiFetch<CursorPage<PublicListing>>(`/listings?city=${city}&sort=updated`).catch(() => null),
    apiFetch<{ count: number; capped: boolean }>(`/listings/count?city=${city}`).catch(() => null),
    apiFetch<CursorPage<PublicListing>>(`/listings?city=${city}&sort=priceasc`).catch(() => null),
    apiFetch<CursorPage<PublicListing>>(`/listings?city=${city}&sort=pricedesc`).catch(() => null),
  ]);

  const listings = listingsPage?.items ?? [];
  const low = cheapest?.items[0]?.priceRent;
  const high = dearest?.items[0]?.priceRent;

  // Neighbourhood names come from real listings, ordered by how often they
  // appear. Names only, no counts: this is one page of results, so a count
  // would understate a city with more listings than we fetched.
  const frequency = new Map<string, number>();
  for (const listing of listings) {
    frequency.set(listing.neighborhood, (frequency.get(listing.neighborhood) ?? 0) + 1);
  }
  const neighborhoods = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);

  return {
    cityName,
    listings,
    count,
    priceRange: low !== undefined && high !== undefined ? { min: low, max: high } : null,
    neighborhoods,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const cityName = CITY_LABELS[city.toLowerCase()];
  if (!cityName) {
    return { title: 'Ville introuvable', robots: { index: false, follow: false } };
  }

  // The root layout's title template appends " | Dari"; adding it here doubles it.
  const title = `Colocation à ${cityName} — chambres et studios`;
  const description = `Trouvez une chambre ou un studio en colocation à ${cityName}. Loyers annoncés charges comprises, profils vérifiés avant le premier contact.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE}/flatshare/${city.toLowerCase()}` },
    openGraph: { title, description, type: 'website', url: `${SITE}/flatshare/${city.toLowerCase()}`, locale: 'fr_MA' },
  };
}

export default async function CityLandingPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const data = await getCityData(city);

  // An unknown slug used to silently render Rabat's content under its URL,
  // which is a duplicate page for a city that does not exist.
  if (!data) notFound();

  const { cityName, listings, count, priceRange, neighborhoods } = data;
  const money = amount;

  return (
    <main style={{ padding: 'var(--space-8) var(--gutter-desktop) var(--space-11)' }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'grid', gap: 'var(--space-8)' }}>
        <section
          style={{
            background: 'linear-gradient(180deg, var(--clay-50) 0%, var(--bg-page) 72%)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'var(--space-9)',
            border: '1px solid var(--border-hairline)',
          }}
        >
          <div style={{ display: 'grid', gap: 'var(--space-4)', maxWidth: 700 }}>
            <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: '0.5rem', color: 'var(--clay-700)', background: 'var(--brand-subtle)', borderRadius: 'var(--radius-pill)', padding: '0.5rem 0.8rem', font: 'var(--type-label)' }}>
              <ShieldCheck size={16} />
              Annonces vérifiées
            </span>
            <h1 style={{ margin: 0, font: 'var(--weight-extra) clamp(32px, 5vw, 48px)/1.08 var(--font-display)', letterSpacing: 'var(--ls-display)' }}>
              Colocation à {cityName}
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', font: 'var(--type-body-lg)', maxWidth: 600 }}>
              Trouvez une chambre, un studio ou une colocation à {cityName}, avec des loyers annoncés
              charges comprises et des profils vérifiés avant le premier contact.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
              <a
                href={`/listings?city=${encodeURIComponent(cityName)}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'var(--brand)',
                  color: '#fff',
                  borderRadius: 'var(--radius-pill)',
                  padding: '0.85rem 1.2rem',
                  textDecoration: 'none',
                  font: 'var(--weight-semibold) var(--type-body) var(--font-ui)',
                }}
              >
                Voir les annonces
                <ArrowRight size={16} />
              </a>
              {/* Stated only when there are real listings to derive it from. */}
              {priceRange && (
                <span style={{ color: 'var(--text-muted)', font: 'var(--type-body)' }}>
                  Loyers de {money(priceRange.min)} à {money(priceRange.max)} MAD
                </span>
              )}
            </div>
          </div>
        </section>

        {/*
          Two figures, both measured. The page used to carry a third -- an
          average response time -- which nothing in the product records.
        */}
        {(count || priceRange) && (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-5)' }}>
            {count && (
              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-card)', padding: '1.25rem' }}>
                <div style={{ font: 'var(--weight-bold) 28px/1.2 var(--font-display)', color: 'var(--text-heading)' }}>
                  {count.capped ? `${count.count}+` : count.count}
                </div>
                <div style={{ color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>
                  annonce{count.count > 1 ? 's' : ''} active{count.count > 1 ? 's' : ''}
                </div>
              </div>
            )}
            {priceRange && (
              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-card)', padding: '1.25rem' }}>
                <div style={{ font: 'var(--weight-bold) 28px/1.2 var(--font-display)', color: 'var(--text-heading)' }}>
                  {money(priceRange.min)} MAD
                </div>
                <div style={{ color: 'var(--text-muted)', font: 'var(--type-body-sm)' }}>loyer le plus bas</div>
              </div>
            )}
          </section>
        )}

        {neighborhoods.length > 0 && (
          <section style={{ background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-card)', padding: 'var(--space-6)' }}>
            <h2 style={{ margin: '0 0 var(--space-4)', font: 'var(--weight-bold) 30px/1.2 var(--font-display)' }}>
              Quartiers à {cityName}
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {neighborhoods.map((name) => (
                <a
                  key={name}
                  href={`/listings?city=${encodeURIComponent(cityName)}&neighborhood=${encodeURIComponent(name)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.6rem 0.9rem',
                    color: 'var(--text-heading)',
                    textDecoration: 'none',
                    font: 'var(--type-body-sm)',
                  }}
                >
                  <MapPin size={15} color="var(--brand)" />
                  {name}
                </a>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 style={{ margin: '0 0 var(--space-4)', font: 'var(--weight-bold) 30px/1.2 var(--font-display)' }}>
            Dernières annonces à {cityName}
          </h2>
          {listings.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>
              Aucune annonce disponible à {cityName} pour le moment.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-5)' }}>
              {listings.slice(0, 6).map((listing) => (
                <ListingCard
                  key={listing.id}
                  title={listing.title}
                  district={listing.neighborhood}
                  city={listing.city}
                  price={money(listing.priceRent)}
                  image={listing.coverPhotoUrl ? `${apiOrigin}${listing.coverPhotoUrl}` : undefined}
                  href={`/listings/${listing.id}`}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
