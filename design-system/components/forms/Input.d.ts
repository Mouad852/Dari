/**
 * Text input with label, helper and error states.
 */
export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  /** Lucide slug shown inside, left. */
  iconLeft?: string;
  /** Trailing unit text, e.g. "MAD / mois". */
  suffix?: string;
  /** Error message — replaces helper and reddens the border. */
  error?: string;
  helper?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}
export function Input(props: InputProps): JSX.Element;
