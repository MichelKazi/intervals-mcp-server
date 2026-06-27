import { cn } from '../../lib/cn';
import { ZoneBadge } from '../ZoneBadge';
import { ZoneDot } from '../ZoneDot';
import type { ActivityRowProps } from './ActivityRow.types';

/**
 * @component ActivityRow
 * @description Compact activity list row (not a card): leading zone dot, name +
 * date, optional RACE/INTERVALS badge, and right-aligned duration · TSS ·
 * optional distance.
 * @spec flex items-center gap-3; left ZoneDot size md; name text-sm font-medium
 * truncate with date text-xs muted below; right metrics mono tabular-nums
 * text-xs secondary. Clickable rows render a full-width left-aligned button with
 * active:scale-[0.99].
 * @accessibility When clickable, a <button> whose accessible name is the
 * activity name. The ZoneDot carries its own zone aria-label.
 */

/** "1h 58m" / "45m" from seconds. */
function formatDuration(secs: number): string {
  const total = Math.round(secs / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "32.5 km" from meters. */
function formatDistance(m: number): string {
  return `${(m / 1000).toFixed(1)} km`;
}

export function ActivityRow({
  name,
  date,
  durationSecs,
  tss,
  distanceM,
  zone,
  isRace = false,
  isInterval = false,
  onClick,
  className,
}: ActivityRowProps) {
  const badge = isRace ? (
    <ZoneBadge zone={4} label="RACE" />
  ) : isInterval ? (
    <ZoneBadge zone={4} label="INTERVALS" />
  ) : null;

  const content = (
    <>
      <ZoneDot zone={zone} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-ui text-sm font-medium text-text-primary">{name}</span>
          {badge}
        </span>
        <span className="block text-xs text-text-muted">{date}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end font-mono text-xs tabular-nums text-text-secondary">
        <span>
          {formatDuration(durationSecs)} · {tss} TSS
        </span>
        {distanceM != null && <span className="text-text-muted">{formatDistance(distanceM)}</span>}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-3 text-left transition-transform active:scale-[0.99]',
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return <div className={cn('flex items-center gap-3', className)}>{content}</div>;
}
