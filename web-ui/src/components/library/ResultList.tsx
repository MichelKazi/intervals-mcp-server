import type { LibraryWorkout } from '../../lib/types';
import { formatDuration } from '../../lib/format';

const ZONE_COLORS: Record<string, string> = {
  endurance: 'var(--z2)',
  tempo: 'var(--z3)',
  sweet_spot: 'var(--z4)',
  threshold: 'var(--z5)',
  vo2max: 'var(--z6)',
  anaerobic: 'var(--z7)',
  recovery: 'var(--z1)',
};

function zoneLabel(zone: string): string {
  return zone.replace(/_/g, ' ');
}

interface ResultListProps {
  workouts: LibraryWorkout[];
  isLoading: boolean;
  onSelect: (w: LibraryWorkout) => void;
}

export default function ResultList({ workouts, isLoading, onSelect }: ResultListProps) {
  if (isLoading) {
    return (
      <div>
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            role="status"
            aria-label="Loading"
            className="mb-2 h-[68px] animate-pulse rounded-md bg-muted opacity-50"
          />
        ))}
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <p className="p-4 text-center text-muted-foreground">
        No workouts match — adjust filters.
      </p>
    );
  }

  return (
    <div>
      {workouts.map((w, idx) => (
        <button
          key={w.tr_workout_id ?? idx}
          type="button"
          onClick={() => onSelect(w)}
          className="mb-2 flex min-h-[44px] w-full cursor-pointer flex-col gap-1 rounded-md border border-border bg-card p-3 text-left text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex-1 text-sm font-semibold">{w.name}</span>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {w.duration_secs ? formatDuration(w.duration_secs) : '—'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {w.tss != null && (
              <span className="text-xs text-muted-foreground">{Math.round(w.tss)} TSS</span>
            )}
            {w.interval_count != null && w.interval_count > 0 && (
              <span className="text-xs text-muted-foreground">{w.interval_count} intervals</span>
            )}
            {(w.zone_focus ?? []).map(z => (
              <span
                key={z}
                className="rounded-sm px-1.5 py-0.5 text-[11px] font-semibold capitalize text-white"
                style={{ background: ZONE_COLORS[z] ?? 'var(--surface-2)' }}
              >
                {zoneLabel(z)}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
