import type { Metadata } from 'next';

import { CITIES, citySlug } from '@/lib/cities';

import { SearchResults } from './SearchResults';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * A thin server wrapper so search can carry metadata.
 *
 * The results themselves stay a client component — filters, the map and the
 * favourite toggles are the whole point of this page, and there is nothing here
 * a crawler needs that the city landing pages do not already serve better.
 *
 * What matters is the canonical. Every filter combination is its own URL
 * (`?city=Rabat&amenities=wifi&priceMin=2000`), and left alone each one is a
 * separate indexable page competing with the city page and with every other
 * permutation of itself. Pointing them all at `/flatshare/{city}` consolidates
 * that instead of fragmenting it.
 *
 * Canonical rather than `noindex`: the two together are contradictory signals —
 * a page cannot both be excluded and be a duplicate of something else — and the
 * consolidation is what is actually wanted here.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = Array.isArray(params.city) ? params.city[0] : params.city;

  // Only a city we actually serve earns a canonical to its landing page; an
  // unrecognised value falls back to the bare search URL.
  const city = CITIES.find((known) => known.toLowerCase() === (raw ?? '').trim().toLowerCase());

  // No " | Dari" here: the root layout's title template appends it. Adding it
  // manually renders "... | Dari | Dari".
  const title = city ? `Annonces de colocation à ${city}` : 'Rechercher une colocation';

  return {
    title,
    description: city
      ? `Parcourez les chambres et studios en colocation disponibles à ${city}.`
      : 'Parcourez les chambres et studios en colocation au Maroc.',
    alternates: {
      canonical: city ? `${SITE}/flatshare/${citySlug(city)}` : `${SITE}/listings`,
    },
  };
}

export default function ListingsPage() {
  return <SearchResults />;
}
