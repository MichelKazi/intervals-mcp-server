import type { IntervalLap } from '../../lib/types';
import { formatDuration, formatWatts } from '../../lib/format';
import { cn } from '@/lib/utils';

interface LapListProps {
  laps: IntervalLap[];
  selectedLapIdx?: number | null;
  onSelectLap?: (idx: number) => void;
}

const GRID = 'grid grid-cols-[32px_1fr_64px_56px_56px]';

export default function LapList({ laps, selectedLapIdx, onSelectLap }: LapListProps) {
  if (laps.length === 0) return null;

  return (
    <div className="mx-4 mb-4">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Laps
      </h2>
      <div className="overflow-hidden rounded-md bg-card">
        {/* Header row */}
        <div className={cn(GRID, 'border-b border-border px-3 py-2')}>
          {['#', 'Time', 'Watts', 'HR', 'Cad'].map((h) => (
            <span key={h} className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground">
              {h}
            </span>
          ))}
        </div>

        {laps.map((lap, idx) => {
          const isSelected = selectedLapIdx === idx;
          const duration = lap.moving_time ?? lap.elapsed_time;
          return (
            <button
              key={idx}
              data-testid="lap-row"
              onClick={() => onSelectLap?.(idx)}
              className={cn(
                GRID,
                'min-h-[44px] w-full cursor-pointer items-center border-none px-3 py-3 text-left',
                idx < laps.length - 1 && 'border-b border-border',
                isSelected ? 'bg-muted' : 'bg-transparent',
              )}
              aria-pressed={isSelected}
              aria-label={`Lap ${idx + 1}`}
            >
              <span className="text-[13px] text-muted-foreground">{idx + 1}</span>
              <span className="text-[13px] text-foreground">
                {duration ? formatDuration(duration) : '—'}
              </span>
              <span className="text-[13px] tabular-nums text-foreground">
                {lap.average_watts ? formatWatts(lap.average_watts) : '—'}
              </span>
              <span className="text-[13px] tabular-nums text-foreground">
                {lap.average_heartrate ? Math.round(lap.average_heartrate) : '—'}
              </span>
              <span className="text-[13px] tabular-nums text-foreground">
                {lap.average_cadence ? Math.round(lap.average_cadence) : '—'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
