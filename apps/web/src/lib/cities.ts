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

/**
 * Map centre per city, for a map that has to open somewhere before the user has
 * chosen anything.
 *
 * Hard-coded for the same reason as CITIES above: a centre is needed to draw the
 * first frame, and waiting on a request to do it means a visible jump. Shared
 * rather than duplicated because both the search map and the publish wizard's
 * location picker need it, and two copies drift.
 */
export const CITY_CENTERS: Record<string, [number, number]> = {
  Rabat: [33.9716, -6.8498],
  Casablanca: [33.5731, -7.5898],
  Marrakech: [31.6295, -7.9811],
  Tanger: [35.7595, -5.834],
};

/** Rabat, when the city is unknown or not one of the four. */
export const DEFAULT_CENTER: [number, number] = [33.9716, -6.8498];

export function centerFor(city: string): [number, number] {
  return CITY_CENTERS[city] ?? DEFAULT_CENTER;
}

/**
 * Great-circle distance in metres. Used only to tell an owner their pin is
 * nowhere near the city they picked, so the cheap spherical formula is fine.
 */
export function distanceMetres(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
