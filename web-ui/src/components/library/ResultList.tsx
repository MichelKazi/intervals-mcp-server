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
            style={{
              height: 68,
              background: 'var(--surface-2)',
              borderRadius: 'var(--radius)',
              marginBottom: 'var(--sp-2)',
              opacity: 0.5,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <p style={{ color: 'var(--text-dim)', padding: 'var(--sp-4)', textAlign: 'center' }}>
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
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-1)',
            width: '100%',
            minHeight: 44,
            padding: 'var(--sp-3)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            marginBottom: 'var(--sp-2)',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'var(--text)',
            fontFamily: 'var(--font)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--sp-2)' }}>
            <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{w.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
              {w.duration_secs ? formatDuration(w.duration_secs) : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            {w.tss != null && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{Math.round(w.tss)} TSS</span>
            )}
            {w.interval_count != null && w.interval_count > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{w.interval_count} intervals</span>
            )}
            {(w.zone_focus ?? []).map(z => (
              <span
                key={z}
                style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: ZONE_COLORS[z] ?? 'var(--surface-2)',
                  color: '#fff',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
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
