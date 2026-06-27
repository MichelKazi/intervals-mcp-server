import type { Zone } from '../../lib/zones';

export type ZoneBadgeColor =
  | 'zone1'
  | 'zone2'
  | 'zone3'
  | 'zone4'
  | 'zone5'
  | 'good'
  | 'caution'
  | 'danger'
  | 'accent';

export interface ZoneBadgeProps {
  /** Zone 1-5; derives color and label when `color`/`label` not given. */
  zone?: Zone;
  /** Override label text. Falls back to the zone name. */
  label?: string;
  /** Explicit color key; takes precedence over `zone`. */
  color?: ZoneBadgeColor;
  /** Padding scale. Default sm. */
  size?: 'sm' | 'md';
  /** Visual style. Default subtle. */
  variant?: 'subtle' | 'solid' | 'outline';
  className?: string;
}
