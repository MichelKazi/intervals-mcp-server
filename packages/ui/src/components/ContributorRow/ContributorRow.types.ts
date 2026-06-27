export interface ContributorRowProps {
  /** Left-hand label, fixed width. */
  label: string;
  /** Score 0–100 driving the bar fill width (clamped). */
  value: number;
  /** Shown in the value cell instead of the raw score, e.g. "6.4h", "57bpm". */
  displayValue?: string;
  /** Trend arrow appended after the value. */
  trend?: 'up' | 'down' | 'flat';
  /** CSS color for the gradient bar fill. */
  color: string;
  /** Animate the bar width from 0 to value% on mount. */
  animated?: boolean;
  className?: string;
}
