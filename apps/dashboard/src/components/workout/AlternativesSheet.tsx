import type { LibraryWorkout } from '../../lib/types';
import { formatDuration } from '../../lib/format';
import { cn } from '@/lib/utils';

interface AlternativesSheetProps {
  alternatives: LibraryWorkout[];
  loading: boolean;
  error?: string | null;
}

const MESSAGE_BOX = 'rounded-md bg-card p-4 text-[13px] text-muted-foreground';

export default function AlternativesSheet({ alternatives, loading, error }: AlternativesSheetProps) {
  return (
    <div className="mx-4 mb-4">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Alternatives
      </h2>

      {loading && <div className={MESSAGE_BOX}>Finding alternatives…</div>}

      {error && !loading && <div className={MESSAGE_BOX}>Could not load alternatives.</div>}

      {!loading && !error && alternatives.length === 0 && (
        <div className={MESSAGE_BOX}>No alternatives found.</div>
      )}

      {!loading && alternatives.length > 0 && (
        <div className="aura-glass overflow-hidden rounded-md">
          {alternatives.map((w, idx) => (
            <div
              key={w.tr_workout_id ?? idx}
              className={cn(
                'flex items-center justify-between gap-3 px-4 py-3',
                idx < alternatives.length - 1 && 'border-b border-border',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{w.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {w.zone_focus?.join(', ')}
                  {w.tss ? ` · ${w.tss} TSS` : ''}
                </div>
              </div>
              <div className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                {w.duration_secs ? formatDuration(w.duration_secs) : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
