import type { IntervalLap } from '../../lib/types';
import { formatDuration, formatWatts, zoneColor, DEFAULT_FTP } from '../../lib/format';
import { cn } from '@/lib/utils';

interface LapListProps {
  laps: IntervalLap[];
  selectedLapIdx?: number | null;
  onSelectLap?: (idx: number) => void;
  ftp?: number;
}

const GRID = 'grid grid-cols-[32px_1fr_64px_56px_56px]';

export default function LapList({ laps, selectedLapIdx, onSelectLap, ftp = DEFAULT_FTP }: LapListProps) {
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
          const pct = lap.average_watts ? (lap.average_watts / ftp) * 100 : 0;
          const dotColor = lap.average_watts ? zoneColor(pct) : 'var(--border)';
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
              <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: dotColor }}
                />
                {idx + 1}
              </span>
              <span className="text-[13px] text-foreground">
                {duration ? formatDuration(duration) : '—'}
              </span>
              <span
                className="font-mono text-[13px] font-semibold tabular-nums"
                style={{ color: lap.average_watts ? dotColor : 'var(--text-dim)' }}
              >
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
