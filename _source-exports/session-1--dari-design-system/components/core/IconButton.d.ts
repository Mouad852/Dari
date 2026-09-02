/** Circular icon-only control. */
export interface IconButtonProps {
  /** Lucide slug. */
  icon?: string;
  size?: 'sm' | 'md' | 'lg';
  /** glass = translucent over photography; brand = filled terracotta. */
  variant?: 'secondary' | 'glass' | 'ghost' | 'brand';
  /** Toggled state (favourite saved) — tints the glyph terracotta. */
  active?: boolean;
  /** Accessible label; required in practice. */
  label?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}
export function IconButton(props: IconButtonProps): JSX.Element;
