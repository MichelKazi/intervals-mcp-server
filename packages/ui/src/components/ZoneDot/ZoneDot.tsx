import { cn } from '../../lib/cn';
import { ZONE_COLORS, ZONE_LABELS } from '../../lib/zones';
import type { ZoneDotProps } from './ZoneDot.types';

/**
 * @component ZoneDot
 * @description Filled circle colored by training zone. Compact zone indicator.
 * @spec
 * - Solid circle, backgroundColor from ZONE_COLORS[zone] (inline style, no other colors).
 * - size xs|sm|md|lg maps to 4|6|8|12px. Default md.
 * - pulse toggles a subtle pulse animation.
 * @accessibility
 * - role="img" with aria-label "Zone {n}: {label}".
 */

const SIZE_PX: Record<NonNullable<ZoneDotProps['size']>, number> = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
};

export function ZoneDot({ zone, size = 'md', pulse = false, className }: ZoneDotProps) {
  const px = SIZE_PX[size];
  return (
    <span
      role="img"
      aria-label={`Zone ${zone}: ${ZONE_LABELS[zone]}`}
      className={cn('inline-block rounded-full', pulse && 'animate-pulse', className)}
      style={{ width: px, height: px, backgroundColor: ZONE_COLORS[zone] }}
    />
  );
}
