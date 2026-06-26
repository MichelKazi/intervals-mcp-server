import type { LibraryWorkout } from '../../lib/types';
import { formatDuration } from '../../lib/format';
import ZoneBadge from '../viz/ZoneBadge';
import AdaptiveBadge from '../viz/AdaptiveBadge';
import SkeletonCard from '../viz/SkeletonCard';
import type { Zone } from '../viz/zoneColors';

/** Map zone_focus string → numeric Zone (1–5) for ZONE_COLORS lookup. */
const ZONE_MAP: Record<string, Zone> = {
  recovery: 1,
  endurance: 1,
  zone2: 1,
  tempo: 2,
  sweet_spot: 3,
  threshold: 3,
  vo2max: 4,
  anaerobic: 5,
  neuromuscular: 5,
};

/**
 * Human-readable overrides for zone_focus values where the ZONE_LABELS for that
 * zone number would be misleading (e.g. sweet_spot maps to zone 3 = "Threshold").
 */
const ZONE_LABEL_OVERRIDE: Record<string, string> = {
  sweet_spot: 'Sweet Spot',
  recovery: 'Recovery',
  zone2: 'Zone 2',
  neuromuscular: 'Neuro',
};

/** Hex colors per zone — kept in sync with zoneColors.ts. */
const ZONE_HEX: Record<Zone, string> = {
  1: '#3b82f6',
  2: '#eab308',
  3: '#f97316',
  4: '#ef4444',
  5: '#a855f7',
};

function primaryZoneColor(zoneFocus?: string[]): string {
  const first = zoneFocus?.[0];
  if (!first) return '#f97316'; // accent orange default
  const zone = ZONE_MAP[first];
  return zone ? ZONE_HEX[zone] : '#f97316';
}

/** Estimate IF from intensity_max if not present on the workout. */
function computeIfValue(w: LibraryWorkout): number {
  if (typeof w.if === 'number') return w.if;
  if (w.intensity_max != null) return w.intensity_max / 100;
  // fall back: assume moderate productive effort
  return 0.88;
}

interface ResultListProps {
  workouts: LibraryWorkout[];
  isLoading: boolean;
  onSelect: (w: LibraryWorkout) => void;
}

export default function ResultList({ workouts, isLoading, onSelect }: ResultListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5 pb-20">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            role="status"
            aria-label="Loading"
          >
            <SkeletonCard rows={3} />
          </div>
        ))}
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <p className="p-4 text-center text-muted-foreground">
        No workouts match. Try a different filter.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 pb-20">
      {workouts.map((w, idx) => {
        const accentColor = primaryZoneColor(w.zone_focus);
        const ifValue = computeIfValue(w);

        return (
          <button
            key={w.tr_workout_id ?? idx}
            type="button"
            onClick={() => onSelect(w)}
            className="flex min-h-[44px] w-full cursor-pointer flex-col gap-1 overflow-hidden rounded-md border border-border bg-card pl-0 pr-3 pt-3 pb-3 text-left text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ borderLeftColor: accentColor, borderLeftWidth: '3px' }}
          >
            {/* Row 1: title + duration */}
            <div className="flex items-center justify-between gap-2 pl-3">
              <span className="flex-1 text-[15px] font-semibold text-slate-100 leading-snug">
                {w.name}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {w.duration_secs ? formatDuration(w.duration_secs) : '—'}
              </span>
            </div>

            {/* Row 2: TSS · intervals */}
            <div className="pl-3 text-[12px] text-slate-500">
              {[
                w.tss != null ? (
                  <span key="tss" className="font-mono">{Math.round(w.tss)} TSS</span>
                ) : null,
                w.interval_count != null && w.interval_count > 0 ? (
                  <span key="intervals" className="font-mono">{w.interval_count} intervals</span>
                ) : null,
              ]
                .filter(Boolean)
                .reduce<React.ReactNode[]>((acc, el, i) => {
                  if (i > 0) acc.push(<span key={`sep-${i}`}> · </span>);
                  acc.push(el);
                  return acc;
                }, [])}
            </div>

            {/* Row 3: zone badges (left) + AdaptiveBadge (right) */}
            <div className="flex items-end justify-between gap-2 pl-3">
              <div className="flex flex-wrap gap-1">
                {(w.zone_focus ?? []).map(z => {
                  const zone = ZONE_MAP[z] as Zone | undefined;
                  const label = ZONE_LABEL_OVERRIDE[z];
                  return (
                    <ZoneBadge
                      key={z}
                      zone={zone}
                      label={label}
                    />
                  );
                })}
              </div>
              <div className="shrink-0">
                <AdaptiveBadge ifValue={ifValue} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
