import type { Zone } from '../../lib/zones';

export interface ZoneDotProps {
  /** Training zone 1-5; sets the dot color. */
  zone: Zone;
  /** Diameter: xs 4px, sm 6px, md 8px, lg 12px. Default md. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Subtle pulse animation. */
  pulse?: boolean;
  className?: string;
}
