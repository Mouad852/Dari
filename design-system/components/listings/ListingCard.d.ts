/**
 * Signature listing card — photo, price, location, flatmate meta.
 */
export interface ListingCardProps {
  /** Photo URL. Renders a warm "PHOTO" placeholder when absent. */
  image?: string;
  title?: string;
  city?: string;
  /** Neighbourhood, shown before the city. */
  district?: string;
  /** Amount without currency, e.g. "3 200". */
  price?: string | number;
  /** Rent period label. Default "mois". */
  period?: string;
  /** Corner flag, e.g. "Nouveau". */
  badge?: string;
  badgeTone?: 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'inverse';
  /** Flatmate summary, e.g. "2 colocataires". */
  flatmates?: string;
  rating?: number | string;
  saved?: boolean;
  onSave?: () => void;
  onClick?: () => void;
  /** vertical = feed/grid card; horizontal = compact list row. */
  layout?: 'vertical' | 'horizontal';
  style?: React.CSSProperties;
}
export function ListingCard(props: ListingCardProps): JSX.Element;
