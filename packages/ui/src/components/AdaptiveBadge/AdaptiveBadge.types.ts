export interface AdaptiveBadgeProps {
  /** Intensity factor (IF), typically 0–1.2+. Drives label and color. */
  intensityFactor: number;
  /** Pill size. @default 'sm' */
  size?: 'sm' | 'md';
  /** Add a title attribute explaining the derived label. @default false */
  showTooltip?: boolean;
  className?: string;
}
