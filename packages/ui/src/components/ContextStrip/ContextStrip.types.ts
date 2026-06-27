export interface ContextStripProps {
  /** Planned training stress for today. */
  plannedTSS: number;
  /** Form (TSB). Can be negative. */
  form: number;
  /** Word describing form, e.g. "Neutral" | "Fresh" | "Fatigued". */
  formLabel: string;
  /** Timing verdict driving the trailing StatusPill. */
  timingStatus: 'good' | 'ok' | 'risky';
  /** Visible timing label, e.g. "Good timing". */
  timingLabel: string;
  className?: string;
}
