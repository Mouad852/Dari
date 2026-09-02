/** Base warm surface container. */
export interface CardProps {
  children?: React.ReactNode;
  /** CSS padding value. Default var(--card-pad) = 16px. */
  padding?: string;
  /** Adds hover lift + pointer. */
  interactive?: boolean;
  elevation?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function Card(props: CardProps): JSX.Element;
