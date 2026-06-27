import type { PowerInterval } from '../PowerChart/PowerChart.types';

export type WorkoutStatus = 'planned' | 'completed' | 'unlogged';

export interface WorkoutCardProps {
  name: string;
  date: string;
  /** "Ride", "Run", etc. */
  type: string;
  durationSecs: number;
  tss: number;
  /** Drives the AdaptiveBadge difficulty pill when present. */
  intensityFactor?: number;
  /** Interval structure; when non-empty, renders an embedded PowerChart. */
  intervals?: PowerInterval[];
  /** Plain-English summary, passed through to PowerChart. */
  summary?: string;
  status?: WorkoutStatus;
  onClick?: () => void;
  /** Overrides the button's accessible name (defaults to "{name}, {status}"). */
  ariaLabel?: string;
  className?: string;
}
