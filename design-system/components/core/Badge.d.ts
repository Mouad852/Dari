/** Status marker pill. */
export interface BadgeProps {
  children?: React.ReactNode;
  tone?: 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'inverse';
  /** Lucide slug shown before the label. */
  icon?: string;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}
export function Badge(props: BadgeProps): JSX.Element;
