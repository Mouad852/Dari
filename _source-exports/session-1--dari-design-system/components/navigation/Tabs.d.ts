/**
 * Section switcher — underline (page level) or segmented (inside cards/sheets).
 */
export interface TabsProps {
  /** Strings, or {value,label,count}. */
  tabs?: Array<string | { value: string; label: string; count?: number }>;
  value?: string;
  onChange?: (value: string) => void;
  variant?: 'underline' | 'segmented';
  style?: React.CSSProperties;
}
export function Tabs(props: TabsProps): JSX.Element;
