/** Transient confirmation message. */
export interface ToastProps {
  children?: React.ReactNode;
  tone?: 'neutral' | 'success' | 'danger';
  /** Lucide slug override. */
  icon?: string;
  /** Inline action label, e.g. "Annuler". */
  action?: string;
  onAction?: () => void;
  style?: React.CSSProperties;
}
export function Toast(props: ToastProps): JSX.Element;
