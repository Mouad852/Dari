/**
 * Every user-visible number and date goes through this module.
 *
 * Hand-ported verbatim from apps/web/src/lib/format.ts -- the copy rules
 * (thin-space thousands, decimal comma, currency after the amount) are
 * product decisions, not web-specific ones, and drift the same way any
 * hand-duplicated logic does if each screen formats its own strings
 * instead. `ListingCard.tsx` and `listing/[id].tsx` originally reached for
 * `Math.round(x).toLocaleString('fr-FR')` -- exactly the "six call sites
 * reaching for Intl.NumberFormat" mistake `amount()`'s own comment warns
 * about, just a different ICU call -- fixed to use `rentPerMonth` instead
 * once this file existed to import from.
 */

/** U+202F narrow no-break space: the French thousands separator. */
const THIN_SPACE = ' ';

function groupThousands(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
}

/** 3200 -> "3 200". The bare amount, for a component that supplies its own currency and period. */
export function amount(value: number): string {
  return groupThousands(value);
}

/** 3200 -> "3 200 MAD/mois". Rent always states its period. */
export function rentPerMonth(amount: number): string {
  return `${groupThousands(amount)}${THIN_SPACE}MAD/mois`;
}

/** 3200 -> "3 200 MAD". For deposits and one-off amounts, which have no period. */
export function mad(amount: number): string {
  return `${groupThousands(amount)}${THIN_SPACE}MAD`;
}

/** 1843 -> "1,8 km"; 640 -> "640 m". Rounded on purpose -- see the web copy's own note on location-fuzzing precision. */
export function distance(metres: number): string {
  if (metres < 1000) {
    return `${Math.round(metres / 100) * 100}${THIN_SPACE}m`;
  }
  return `${(metres / 1000).toFixed(1).replace('.', ',')}${THIN_SPACE}km`;
}

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;

/** French long form: "1er septembre", "3 septembre". */
export function longDate(date: Date): string {
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  return `${day === 1 ? '1er' : day} ${month}`;
}

/** "il y a 3 jours" — relative, for message and listing timestamps. */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} jour${days > 1 ? 's' : ''}`;
  return longDate(date);
}

/**
 * "14:32" — wall-clock time, for a message bubble. Zero-padded by hand
 * rather than through Intl: `fr-MA` resolves to a locale whose formatting
 * has already surprised this codebase once, in `amount`.
 */
export function clockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Day separator label: "Aujourd'hui", "Hier", "3 septembre", "3 septembre 2025". */
export function dayLabel(date: Date, now: Date = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  const base = longDate(date);
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
}
