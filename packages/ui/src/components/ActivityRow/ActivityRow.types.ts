import type { Zone } from '../../lib/zones';

export interface ActivityRowProps {
  /** Activity name; the row's accessible name when clickable. */
  name: string;
  /** Date label shown under/next to the name (e.g. "Mon, Jun 23"). */
  date: string;
  /** Duration in seconds; formatted as "1h 58m" / "45m". */
  durationSecs: number;
  /** Training Stress Score. */
  tss: number;
  /** Distance in meters; rendered as km (1 decimal) when given. */
  distanceM?: number;
  /** Primary training zone 1-5; sets the leading dot color. */
  zone: Zone;
  /** Renders a RACE badge. Takes precedence over isInterval. */
  isRace?: boolean;
  /** Renders an INTERVALS badge when not a race. */
  isInterval?: boolean;
  /** When set, the row is a full-width button firing this on click. */
  onClick?: () => void;
  className?: string;
}
