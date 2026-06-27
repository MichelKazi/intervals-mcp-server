export type MetricValueSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export interface MetricValueProps {
  /** The number (or pre-formatted string) to display. */
  value: number | string;
  /** Trailing unit, e.g. "W", "bpm", "ms", "h", "TSS". */
  unit?: string;
  /** Type-scale step; 2xl/3xl render bold. */
  size?: MetricValueSize;
  /** CSS color applied inline to the number only. */
  color?: string;
  /** Count up from 0 to the value on mount (numbers only, honors reduced-motion). */
  animated?: boolean;
  /** Use the mono typeface (default) vs the UI sans. */
  mono?: boolean;
  className?: string;
}
