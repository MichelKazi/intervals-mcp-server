import { useQuery } from '@tanstack/react-query';

import AppShell from '@/components/AppShell';
import { SparkLine, SkeletonCard } from '@/components/viz';
import { getWellness } from '@/lib/api';
import type { WellnessDay } from '@/lib/types';

// ─── Parsing dose entries from wellness comments ──────────────────────────────

interface DoseEntry {
  date: string;
  compound: string;
  dose: string;
  note: string;
}

const DOSE_RE = /(tirzepatide|peptide|cjc[- ]?1295|ipamorelin|semaglutide)/i;
const AMOUNT_RE = /(\d+(?:\.\d+)?\s*(?:units?|mg|mcg|ml|iu))/i;

function compoundName(comment: string): string {
  const c = comment.toLowerCase();
  if (c.includes('tirzepatide')) return 'Tirzepatide';
  if (c.includes('cjc') || c.includes('ipamorelin')) return 'CJC-1295 / Ipamorelin';
  if (c.includes('semaglutide')) return 'Semaglutide';
  return 'Peptide';
}

function parseDoses(days: WellnessDay[]): DoseEntry[] {
  const out: DoseEntry[] = [];
  for (const d of days) {
    const comment = typeof d.comments === 'string' ? d.comments : '';
    if (!comment || !DOSE_RE.test(comment)) continue;
    const amount = comment.match(AMOUNT_RE)?.[1] ?? '—';
    out.push({
      date: String(d.id),
      compound: compoundName(comment),
      dose: amount,
      note: comment,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr + 'T00:00:00').getTime();
  return Math.max(0, Math.round((Date.now() - then) / 86_400_000));
}

// Thursday-protocol next-dose countdown (next Thursday from today).
function daysUntilThursday(): number {
  const now = new Date();
  const dow = now.getDay(); // 0 Sun … 4 Thu
  const diff = (4 - dow + 7) % 7;
  return diff === 0 ? 7 : diff;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DoseLog() {
  const newest = new Date().toISOString().slice(0, 10);
  const oldest = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);

  const q = useQuery({
    queryKey: ['dose-log', oldest, newest],
    queryFn: () => getWellness(oldest, newest),
  });

  const body = (() => {
    if (q.isLoading) return <div className="space-y-3"><SkeletonCard rows={3} /><SkeletonCard rows={5} /></div>;
    if (q.isError) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[13px] text-slate-400">Could not load wellness log.</p>
          <button onClick={() => q.refetch()} className="min-h-[44px] rounded-lg bg-bg-raised px-4 text-[13px] font-semibold text-slate-100">Retry</button>
        </div>
      );
    }

    const days = q.data ?? [];
    const entries = parseDoses(days);
    const hrvSeries = days
      .filter((d) => typeof d.hrv === 'number')
      .map((d) => ({ date: String(d.id), hrv: d.hrv as number }));

    if (entries.length === 0) {
      return (
        <p className="py-12 text-center text-[13px] text-slate-400">
          No dose entries found in your wellness comments.
        </p>
      );
    }

    const untilThu = daysUntilThursday();

    return (
      <div className="space-y-4">
        <section className="flex items-center gap-4 rounded-2xl border border-border-default bg-bg-surface p-4">
          <div className="flex flex-col items-center">
            <span className="font-mono text-3xl font-semibold text-accent">{untilThu}</span>
            <span className="text-[10px] uppercase tracking-widest text-slate-500">days</span>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-100">Next dose</div>
            <p className="text-[12px] text-slate-400">Thursday protocol · {entries[0].compound}</p>
          </div>
        </section>

        {hrvSeries.length >= 2 && (
          <section className="rounded-2xl border border-border-default bg-bg-surface p-4">
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-slate-500">
              HRV Trend
            </h2>
            <SparkLine data={hrvSeries.map((h) => h.hrv)} color="#3b82f6" width={300} height={48} className="w-full" />
            <div className="mt-2 flex justify-between font-mono text-[11px] text-slate-500">
              <span>{hrvSeries[0].date}</span>
              <span>latest {hrvSeries[hrvSeries.length - 1].hrv}ms</span>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-border-default bg-bg-surface p-4">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-slate-500">
            Dose Timeline
          </h2>
          <ul className="space-y-3">
            {entries.map((e, i) => (
              <li key={i} className="border-b border-border-subtle pb-3 last:border-0 last:pb-0" data-testid="dose-row">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-slate-100">{e.compound}</span>
                  <span className="font-mono text-[12px] text-accent">{e.dose}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-slate-500">
                  <span>{e.date}</span>
                  <span className="text-slate-600">·</span>
                  <span>{daysSince(e.date)}d ago</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">{e.note}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  })();

  return (
    <AppShell title="Medical Log" showBack>
      <div className="screen">
        <p className="mb-3 text-[11px] leading-snug text-slate-500">
          Medical Log — compound and dose records parsed from wellness notes. Not coaching guidance.
        </p>
        {body}
      </div>
    </AppShell>
  );
}
