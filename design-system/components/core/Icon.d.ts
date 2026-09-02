/**
 * Lucide icon glyph, masked with currentColor.
 */
export interface IconProps {
  /** Lucide icon slug, e.g. "map-pin", "heart", "shield-check". */
  name?: string;
  /** Pixel box (square). Default 20. */
  size?: number;
  /** Override color; defaults to currentColor. */
  color?: string;
  style?: React.CSSProperties;
}
export function Icon(props: IconProps): JSX.Element;
