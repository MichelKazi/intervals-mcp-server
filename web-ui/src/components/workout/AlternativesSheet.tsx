import type { LibraryWorkout } from '../../lib/types';
import { formatDuration } from '../../lib/format';

interface AlternativesSheetProps {
  alternatives: LibraryWorkout[];
  loading: boolean;
  error?: string | null;
}

export default function AlternativesSheet({ alternatives, loading, error }: AlternativesSheetProps) {
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
        Alternatives
      </h2>

      {loading && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            padding: 'var(--sp-4)',
            color: 'var(--text-dim)',
            fontSize: 13,
          }}
        >
          Finding alternatives…
        </div>
      )}

      {error && !loading && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            padding: 'var(--sp-4)',
            color: 'var(--text-dim)',
            fontSize: 13,
          }}
        >
          Could not load alternatives.
        </div>
      )}

      {!loading && !error && alternatives.length === 0 && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            padding: 'var(--sp-4)',
            color: 'var(--text-dim)',
            fontSize: 13,
          }}
        >
          No alternatives found.
        </div>
      )}

      {!loading && alternatives.length > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
          }}
        >
          {alternatives.map((w, idx) => (
            <div
              key={w.tr_workout_id ?? idx}
              style={{
                padding: 'var(--sp-3) var(--sp-4)',
                borderBottom: idx < alternatives.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--sp-3)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--text)',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {w.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                  {w.zone_focus?.join(', ')}
                  {w.tss ? ` · ${w.tss} TSS` : ''}
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-dim)',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {w.duration_secs ? formatDuration(w.duration_secs) : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
