/**
 * Every user-visible number and date goes through this module.
 *
 * The copy rules are specific — thin-space thousands, decimal comma, currency
 * after the amount, period stated — and they are violated one component at a
 * time when each screen formats its own strings. Centralising them is the
 * difference between a product that reads as local and one that reads as
 * translated.
 */

/** U+202F narrow no-break space: the French thousands separator. */
const THIN_SPACE = ' ';

function groupThousands(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
}

/**
 * 3200 -> "3 200". The bare amount, for a component that supplies its own
 * currency and period -- the design system's ListingCard appends "MAD/mois"
 * itself. Exported because six call sites were reaching for
 * `Intl.NumberFormat('fr-MA')` instead, which this ICU renders as "4.034":
 * a price that reads as four-point-oh-three-four to anyone outside Morocco.
 */
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

/** 4.8 -> "4,8". Decimal comma, one place. */
export function rating(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/** 1843 -> "1,8 km"; 640 -> "640 m". Rounded — see the note on precision below. */
export function distance(metres: number): string {
  if (metres < 1000) {
    // Coarse on purpose. Metre-accurate distances from several reference points
    // triangulate straight through the location fuzzing.
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

/** Listing reference, rendered in the mono face: "DARI-RB-4821". */
export function listingRef(cityCode: string, sequence: number): string {
  return `DARI-${cityCode.toUpperCase()}-${sequence}`;
}
