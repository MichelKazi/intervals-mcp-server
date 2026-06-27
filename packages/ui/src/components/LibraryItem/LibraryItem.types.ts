import type { Zone } from '../../lib/zones';

export interface LibraryItemProps {
  /** Workout name. */
  name: string;
  /** Training stress score. */
  tss: number;
  /** Number of work intervals. */
  intervalCount: number;
  /** Total duration in seconds. */
  durationSecs: number;
  /** Primary zone; drives the left border color. */
  primaryZone: Zone;
  /** Zones to badge. Falls back to [primaryZone]. */
  zones?: Zone[];
  /** Intensity factor; renders an AdaptiveBadge when given. */
  intensityFactor?: number;
  onClick?: () => void;
  className?: string;
}
