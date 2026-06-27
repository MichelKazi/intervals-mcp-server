import { cn } from '@/lib/utils';
import { ZONE_COLORS, ZONE_LABELS, type Zone } from './zoneColors';

export interface ZoneDotProps {
  zone: Zone;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZE_PX: Record<NonNullable<ZoneDotProps['size']>, number> = {
  sm: 8,
  md: 12,
};

/** Filled dot in the zone color. Carries an aria-label (not color-alone). */
export default function ZoneDot({ zone, size = 'md', className }: ZoneDotProps) {
  const px = SIZE_PX[size];
  return (
    <span
      role="img"
      aria-label={`Zone ${zone} — ${ZONE_LABELS[zone]}`}
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{ width: px, height: px, backgroundColor: ZONE_COLORS[zone] }}
    />
  );
}
