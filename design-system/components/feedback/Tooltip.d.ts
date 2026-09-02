/** Desktop hover hint. */
export interface TooltipProps {
  label?: React.ReactNode;
  children?: React.ReactNode;
  placement?: 'top' | 'bottom';
  style?: React.CSSProperties;
}
export function Tooltip(props: TooltipProps): JSX.Element;
