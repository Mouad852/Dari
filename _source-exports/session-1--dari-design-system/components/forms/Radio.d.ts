/** Single-choice radio row. */
export interface RadioProps {
  label?: React.ReactNode;
  description?: string;
  checked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  value?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}
export function Radio(props: RadioProps): JSX.Element;
