import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import WorkoutChart from '../WorkoutChart';
import { ZoneDot, type Zone } from '../viz';
import { getCompliance } from '../../lib/api';
import { formatDate, formatDuration, formatWatts, ftpToZone } from '../../lib/format';
import type { PlannedEvent, Activity, WorkoutStep, Compliance } from '../../lib/types';

interface ActivityDrawerProps {
  item: PlannedEvent | Activity | null;
  ftp: number;
  open: boolean;
  onClose: () => void;
  onOpenFull: (id: string | number) => void;
}

function isDone(ev: PlannedEvent | Activity): boolean {
  return ev.category === 'ACTIVITY' || ev.category === 'DONE';
}

/** Flatten workout_doc steps (recursing repeat blocks) into a target-watts table. */
interface FlatStep {
  zone: Zone;
  name: string;
  durationSecs: number;
  watts?: number;
  pct: number;
}

function flatten(steps: WorkoutStep[], ftp: number): FlatStep[] {
  const out: FlatStep[] = [];
  const walk = (list: WorkoutStep[], parentName?: string) => {
    for (const s of list) {
      if (s.reps && s.steps?.length) {
        for (let i = 0; i < s.reps; i++) walk(s.steps, s.text);
        continue;
      }
      const pct = s.power?.value ?? s.power?.end ?? s.power?.start ?? 0;
      out.push({
        zone: ftpToZone(pct),
        name: s.text ?? parentName ?? (s.warmup ? 'Warmup' : s.cooldown ? 'Cooldown' : 'Interval'),
        durationSecs: s.duration ?? 0,
        watts: pct ? (pct * ftp) / 100 : undefined,
        pct,
      });
    }
  };
  walk(steps);
  return out;
}

function ComplianceBars({ eventId }: { eventId: string | number }) {
  const { data, isLoading, isError } = useQuery<Compliance>({
    queryKey: ['compliance', eventId],
    queryFn: () => getCompliance(eventId),
    retry: 0,
  });

  if (isLoading) return <p className="text-[13px] text-muted-foreground">Loading compliance…</p>;
  if (isError || !data || !data.paired || !data.actual) return null;

  const rows: Array<[string, string, string, number | null]> = [
    [
      'Load',
      data.planned.load != null ? `${data.planned.load} TSS` : '—',
      data.actual.load != null ? `${data.actual.load} TSS` : '—',
      data.compliance.load_pct,
    ],
    [
      'Duration',
      data.planned.duration != null ? formatDuration(data.planned.duration) : '—',
      data.actual.duration != null ? formatDuration(data.actual.duration) : '—',
      data.compliance.duration_pct,
    ],
  ];

  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Planned vs actual
      </p>
      <div className="rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {rows.map(([label, planned, actual, pct]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0" style={{ borderColor: 'var(--border)' }}>
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right text-foreground">
              <span className="font-mono">{planned}</span>
              <span className="mx-1 text-muted-foreground">→</span>
              <span className="font-mono">{actual}</span>
              {pct != null && <span className="ml-2 font-mono text-muted-foreground">{pct}%</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ActivityDrawer({ item, ftp, open, onClose, onOpenFull }: ActivityDrawerProps) {
  const done = item ? isDone(item) : false;
  const steps = item?.workout_doc?.steps ?? [];
  const flat = item && steps.length ? flatten(steps, ftp) : [];
  const intensity = item?.icu_intensity;
  const ifValue = intensity != null ? (intensity <= 2 ? intensity : intensity / 100) : null;

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
        {item && (
          <>
            <SheetHeader className="mb-3">
              <SheetTitle>{item.name}</SheetTitle>
            </SheetHeader>

            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{formatDate(item.start_date_local)}</span>
              {item.moving_time != null && <span className="font-mono">{formatDuration(item.moving_time)}</span>}
              {item.icu_training_load != null && (
                <span className="font-mono">{Math.round(item.icu_training_load)} TSS</span>
              )}
              {ifValue != null && <span className="font-mono">IF {ifValue.toFixed(2)}</span>}
            </div>

            {flat.length > 0 && (
              <div className="mb-4">
                <WorkoutChart steps={steps} ftp={ftp} />
              </div>
            )}

            {done && <ComplianceBars eventId={item.id} />}

            {flat.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Intervals
                </p>
                <ul className="space-y-1" role="list">
                  {flat.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                      <ZoneDot zone={s.zone} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-foreground">{s.name}</span>
                      <span className="shrink-0 font-mono text-[13px] text-muted-foreground">
                        {formatDuration(s.durationSecs)}
                      </span>
                      <span className="w-14 shrink-0 text-right font-mono text-[13px] text-foreground">
                        {s.watts ? formatWatts(s.watts) : `${Math.round(s.pct)}%`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => onOpenFull(item.id)}
              className="mt-5 min-h-[44px] w-full rounded-lg text-sm font-semibold"
              style={{ background: 'var(--surface-2)', color: 'var(--brand)', border: '1px solid var(--border)' }}
            >
              Open full detail
            </button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
