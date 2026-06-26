import type { IntervalLap } from '../../lib/types';
import { formatDuration, formatWatts } from '../../lib/format';

interface LapListProps {
  laps: IntervalLap[];
  selectedLapIdx?: number | null;
  onSelectLap?: (idx: number) => void;
}

export default function LapList({ laps, selectedLapIdx, onSelectLap }: LapListProps) {
  if (laps.length === 0) return null;

  return (
    <div style={{ margin: '0 var(--sp-4) var(--sp-4)' }}>
      <h2
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          margin: '0 0 var(--sp-2)',
        }}
      >
        Laps
      </h2>
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 64px 56px 56px',
            padding: 'var(--sp-2) var(--sp-3)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {['#', 'Time', 'Watts', 'HR', 'Cad'].map((h) => (
            <span
              key={h}
              style={{
                fontSize: 11,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
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
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 64px 56px 56px',
                padding: 'var(--sp-3) var(--sp-3)',
                borderBottom: idx < laps.length - 1 ? '1px solid var(--border)' : 'none',
                background: isSelected ? 'var(--surface-2)' : 'transparent',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                color: 'inherit',
                minHeight: 44,
                alignItems: 'center',
              }}
              aria-pressed={isSelected}
              aria-label={`Lap ${idx + 1}`}
            >
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{idx + 1}</span>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>
                {duration ? formatDuration(duration) : '—'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {lap.average_watts ? formatWatts(lap.average_watts) : '—'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {lap.average_heartrate ? Math.round(lap.average_heartrate) : '—'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {lap.average_cadence ? Math.round(lap.average_cadence) : '—'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
