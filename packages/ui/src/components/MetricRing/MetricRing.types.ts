import type { ContributorRowProps } from '../ContributorRow';

export type MetricRingStatus = 'good' | 'caution' | 'danger' | 'neutral';
export type MetricRingSize = 'sm' | 'md' | 'lg';

export interface MetricRingProps {
  /** Current value, clamped to [0, max] before display. */
  value: number;
  /** Scale ceiling. Default 100. */
  max?: number;
  /** Drives the arc/number color and gradient endpoint. */
  status: MetricRingStatus;
  /** Short verdict word, e.g. "READY". Screen-reader readable. */
  statusWord: string;
  /** One-line interpretation. Required — empty/null throws. */
  meaning: string;
  /** Eyebrow label above the arc, e.g. "READINESS". */
  label?: string;
  /** Renders a ConfoundPill (type custom) below the status word. */
  confound?: string;
  /** Optional contributor breakdown rows. */
  contributors?: ContributorRowProps[];
  /** Arc size. Default 'lg'. */
  size?: MetricRingSize;
  /** Draw the arc on mount. Default true. */
  animated?: boolean;
  /** Tap the ring to toggle the contributor list (collapsed by default). */
  expandable?: boolean;
  className?: string;
}
