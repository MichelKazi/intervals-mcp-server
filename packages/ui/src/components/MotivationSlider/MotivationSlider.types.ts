export interface MotivationSliderProps {
  /** Current motivation, 1-10 integer. */
  value: number;
  /** Fires with the new integer value as the user drags. */
  onChange: (value: number) => void;
  /** Accessible label for the slider. Default "Motivation". */
  label?: string;
  className?: string;
}
