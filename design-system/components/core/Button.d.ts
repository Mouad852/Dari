/**
 * Primary action control for Dari.
 */
export interface ButtonProps {
  children?: React.ReactNode;
  /** primary = terracotta fill; secondary = white + hairline; subtle = clay tint; ghost = text only; danger = destructive. */
  variant?: 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger';
  /** sm 36px / md 44px / lg 52px. md is the mobile default (meets 44px tap target). */
  size?: 'sm' | 'md' | 'lg';
  /** Lucide slug rendered before the label. */
  iconLeft?: string;
  /** Lucide slug rendered after the label. */
  iconRight?: string;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}
export function Button(props: ButtonProps): JSX.Element;
