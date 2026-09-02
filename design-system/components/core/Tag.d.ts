/** Filter chip / amenity tag. */
export interface TagProps {
  children?: React.ReactNode;
  /** Lucide slug. */
  icon?: string;
  /** Selected chips invert to charcoal, not terracotta. */
  selected?: boolean;
  removable?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  style?: React.CSSProperties;
}
export function Tag(props: TagProps): JSX.Element;
