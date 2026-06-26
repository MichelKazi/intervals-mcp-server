import { useQuery } from '@tanstack/react-query';

import AppShell from '@/components/AppShell';
import { getWellness, callMcpText } from '@/lib/api';
import type { WellnessDay } from '@/lib/types';
import {
  DetailSkeleton, DetailError, DetailEmpty, SectionLabel,
  readinessColor, readinessLabel, shortDate, dateRange,
} from './_shared';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Calendar grid: lead with empty cells so day-1 lands under its weekday. */
function HeatmapCell({ day }: { day: WellnessDay | null }) {
  if (!day || day.readiness == null) {
    return (
      <div
        className="aspect-square rounded-md border border-border-subtle bg-bg-raised/40"
        role="img"
        aria-label={day ? `${shortDate(day.id)}: unlogged` : 'empty'}
      />
    );
  }
  const score = day.readiness as number;
  const color = readinessColor(score);
  return (
    <div
      className="flex aspect-square items-center justify-center rounded-md text-[10px] font-semibold text-bg-base"
      style={{ backgroundColor: color }}
      title={`${shortDate(day.id)}: ${Math.round(score)} (${readinessLabel(score)})`}
      role="img"
      aria-label={`${shortDate(day.id)}: readiness ${Math.round(score)}, ${readinessLabel(score)}`}
    >
      <span className="font-mono">{Math.round(score)}</span>
    </div>
  );
}

function Legend() {
  const bands: [string, number][] = [['Strained', 20], ['Caution', 50], ['Ready', 85]];
  return (
    <div className="flex items-center gap-3 px-1 text-[11px] text-slate-400">
      {bands.map(([label, v]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: readinessColor(v) }} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

/** Correlation takeaway line pulled from the recovery patterns text, if present. */
function correlationNote(text: string | null | undefined): string | null {
  if (!text) return null;
  const idx = text.indexOf('Key Takeaways:');
  if (idx >= 0) return text.slice(idx).trim();
  const first = text.split('\n').find((l) => l.includes('Sleepscore') || l.includes('Resting HR'));
  return first?.trim() ?? null;
}

export default function ReadinessHistory() {
  const { oldest, newest } = dateRange(30);
  const wellness = useQuery({ queryKey: ['wellness', oldest, newest], queryFn: () => getWellness(oldest, newest) });
  const recovery = useQuery({ queryKey: ['recovery-patterns'], queryFn: () => callMcpText('get_recovery_patterns') });

  return (
    <AppShell title="Readiness History" showBack>
      {wellness.isLoading && <DetailSkeleton label="readiness history" />}
      {wellness.isError && <DetailError error={wellness.error} onRetry={() => wellness.refetch()} />}
      {!wellness.isLoading && !wellness.isError && (() => {
        const days = (wellness.data ?? []).filter((d) => d.id);
        const scored = days.filter((d) => d.readiness != null);
        if (scored.length === 0) {
          return <DetailEmpty title="No readiness data" body="No readiness scores yet — check your wellness sync." />;
        }
        // Pad the front so the first day aligns with its weekday column.
        const firstDow = new Date(days[0].id + 'T00:00:00').getDay();
        const cells: (WellnessDay | null)[] = [...Array(firstDow).fill(null), ...days];
        const note = correlationNote(recovery.data);

        return (
          <div className="flex flex-col gap-4 p-4 pb-20">
            <div className="rounded-2xl border border-border-subtle bg-bg-surface p-4">
              <SectionLabel>Last 30 days</SectionLabel>
              <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[10px] text-slate-500" aria-hidden="true">
                {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((c, i) => <HeatmapCell key={c?.id ?? `pad-${i}`} day={c} />)}
              </div>
              <div className="mt-3"><Legend /></div>
            </div>

            {note && (
              <div className="rounded-2xl border border-border-subtle bg-bg-surface p-4">
                <SectionLabel>Correlation note</SectionLabel>
                <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-300">{note}</pre>
              </div>
            )}
          </div>
        );
      })()}
    </AppShell>
  );
}
