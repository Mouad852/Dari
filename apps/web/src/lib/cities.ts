/**
 * The four launch cities.
 *
 * Hard-coded on the client for routing and slugs only. The authoritative list —
 * with live counts and neighborhoods — comes from GET /cities; this exists so
 * static params can be generated without a network call at build time.
 *
 * Note the spelling: Tanger, not Tangier. The interface is French throughout.
 */
export const CITIES = ['Rabat', 'Casablanca', 'Marrakech', 'Tanger'] as const;

export type City = (typeof CITIES)[number];

/** The combining-diacritics block, U+0300 to U+036F. */
const DIACRITICS = /[̀-ͯ]/g;

/** "Marrakech" -> "marrakech". Decompose, drop the marks, then lowercase. */
export function citySlug(city: string): string {
  return city
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}

export function cityFromSlug(slug: string): City | undefined {
  return CITIES.find((city) => citySlug(city) === slug);
}
