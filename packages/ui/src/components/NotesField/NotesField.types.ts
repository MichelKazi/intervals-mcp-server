export interface NotesFieldProps {
  /** Current text. */
  value: string;
  /** Fires with the new text (already capped at maxLength). */
  onChange: (value: string) => void;
  /** Hard character cap. Default 500. */
  maxLength?: number;
  /** Accessible label. Default "Notes". */
  label?: string;
  placeholder?: string;
  className?: string;
}
