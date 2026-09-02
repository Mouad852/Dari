/**
 * Modal dialog / bottom sheet.
 */
export interface DialogProps {
  open?: boolean;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Action row, typically two Buttons. */
  footer?: React.ReactNode;
  onClose?: () => void;
  /** Render as a bottom sheet with grab handle (mobile default). */
  sheet?: boolean;
  /** Desktop width in px. Default 440. */
  width?: number;
  style?: React.CSSProperties;
}
export function Dialog(props: DialogProps): JSX.Element | null;
