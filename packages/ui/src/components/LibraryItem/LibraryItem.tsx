import { cn } from '../../lib/cn';
import { ZONE_COLORS, type Zone } from '../../lib/zones';
import { AdaptiveBadge } from '../AdaptiveBadge';
import { ZoneBadge } from '../ZoneBadge';
import type { LibraryItemProps } from './LibraryItem.types';

/**
 * @component LibraryItem
 * @description Compact workout-library row: name, interval/duration meta, zone
 * badges, and an optional difficulty badge, accented by a left border in the
 * primary zone's color.
 * @spec bg-bg-surface rounded-lg p-3 with a 3px left border in
 * ZONE_COLORS[primaryZone]. Name (text-sm font-medium); meta line
 * "{intervalCount} intervals · {formatDuration}". A ZoneBadge per zone (or just
 * primaryZone). AdaptiveBadge when intensityFactor given. Duration right-aligned
 * in mono. Button with active:scale when onClick.
 * @accessibility With onClick the row is a full-width left-aligned button named
 * after the workout; zone/difficulty meaning is carried by badge text.
 */

/** Seconds → "1h 5m" or "45m". */
function formatDuration(secs: number): string {
  const total = Math.round(secs / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function LibraryItem({
  name,
  tss,
  intervalCount,
  durationSecs,
  primaryZone,
  zones,
  intensityFactor,
  onClick,
  className,
}: LibraryItemProps) {
  const badgeZones: Zone[] = zones?.length ? zones : [primaryZone];
  const duration = formatDuration(durationSecs);

  const body = (
    <>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-medium text-sm text-text-primary">{name}</span>
        <span className="text-text-muted text-xs">
          {intervalCount} intervals · {duration}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {badgeZones.map((z, i) => (
            <ZoneBadge key={`${z}-${i}`} zone={z} />
          ))}
          {intensityFactor !== undefined && <AdaptiveBadge intensityFactor={intensityFactor} />}
        </div>
      </div>
      <div className="ml-auto flex shrink-0 flex-col items-end gap-0.5 self-start">
        <span className="font-mono text-sm text-text-secondary">{duration}</span>
        <span className="font-mono text-text-muted text-xs">{tss} TSS</span>
      </div>
    </>
  );

  const rootClass = cn(
    'flex items-start gap-3 rounded-lg border-l-[3px] bg-bg-surface p-3',
    className,
  );
  const style = { borderLeftColor: ZONE_COLORS[primaryZone] };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={name}
        className={cn(rootClass, 'w-full text-left transition active:scale-[0.99]')}
        style={style}
      >
        {body}
      </button>
    );
  }

  return (
    <div className={rootClass} style={style}>
      {body}
    </div>
  );
}
