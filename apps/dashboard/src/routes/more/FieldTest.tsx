import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CalendarPlus } from 'lucide-react';

import AppShell from '@/components/AppShell';
import { SkeletonCard } from '@/components/viz';
import { callMcp, getWellness } from '@/lib/api';
import type { WellnessDay } from '@/lib/types';

// ─── Derivations ──────────────────────────────────────────────────────────────

function latestCtl(days: WellnessDay[]): number | null {
  for (let i = days.length - 1; i >= 0; i--) {
    if (typeof days[i].ctl === 'number') return days[i].ctl as number;
  }
  return null;
}

function parseFtp(athleteText: string): number | null {
  const m = athleteText.match(/FTP:\s*(\d+)\s*W/i);
  return m ? Number(m[1]) : null;
}

// Higher CTL athletes hold longer efforts, so a 20-minute test is appropriate;
// lower fitness favors a ramp test that auto-terminates at failure.
function recommendedTest(ctl: number | null): { type: string; rationale: string } {
  if (ctl == null) return { type: 'Ramp Test', rationale: 'Default protocol when fitness is unknown.' };
  if (ctl >= 60) return { type: '20-Minute Test', rationale: `CTL ${Math.round(ctl)} supports a sustained 20-minute effort.` };
  if (ctl >= 40) return { type: '8-Minute Test', rationale: `CTL ${Math.round(ctl)} suits a shorter 2x8-minute protocol.` };
  return { type: 'Ramp Test', rationale: `CTL ${Math.round(ctl)} — a ramp test auto-terminates at failure.` };
}

// Next Tuesday — a rested mid-week slot for a quality test.
function suggestedDate(): string {
  const d = new Date();
  const diff = (2 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FieldTest() {
  const newest = new Date().toISOString().slice(0, 10);
  const oldest = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
  const [scheduled, setScheduled] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleErr, setScheduleErr] = useState(false);

  const athleteQ = useQuery({
    queryKey: ['athlete'],
    queryFn: () => callMcp('get_athlete', {}) as Promise<{ result?: string } | string>,
  });
  const wellnessQ = useQuery({
    queryKey: ['field-test-wellness', oldest, newest],
    queryFn: () => getWellness(oldest, newest),
  });

  const loading = athleteQ.isLoading || wellnessQ.isLoading;
  const errored = athleteQ.isError || wellnessQ.isError;

  const schedule = async (date: string, type: string) => {
    setScheduling(true);
    setScheduleErr(false);
    try {
      await callMcp('add_or_update_event', { name: `FTP Test — ${type}`, type: 'Ride', start_date: date });
      setScheduled(date);
    } catch {
      setScheduleErr(true);
    } finally {
      setScheduling(false);
    }
  };

  const body = (() => {
    if (loading) return <div className="space-y-3"><SkeletonCard rows={3} /><SkeletonCard rows={2} /></div>;
    if (errored) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[13px] text-slate-400">Could not load profile data.</p>
          <button onClick={() => { athleteQ.refetch(); wellnessQ.refetch(); }} className="min-h-[44px] rounded-lg bg-bg-raised px-4 text-[13px] font-semibold text-slate-100">Retry</button>
        </div>
      );
    }

    const athleteText = typeof athleteQ.data === 'string' ? athleteQ.data : athleteQ.data?.result ?? '';
    const ftp = parseFtp(athleteText);
    const ctl = latestCtl(wellnessQ.data ?? []);
    const rec = recommendedTest(ctl);
    const date = suggestedDate();

    return (
      <div className="space-y-4">
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border-default bg-bg-surface p-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-500">Current FTP</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-slate-100">{ftp != null ? `${ftp}W` : '—'}</div>
          </div>
          <div className="rounded-2xl border border-border-default bg-bg-surface p-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-500">Current CTL</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-slate-100">{ctl != null ? Math.round(ctl) : '—'}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-border-default bg-bg-surface p-4">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-slate-500">Recommended Test</h2>
          <div className="text-[15px] font-semibold text-accent">{rec.type}</div>
          <p className="mt-1 text-[12px] leading-snug text-slate-400">{rec.rationale}</p>
          <div className="mt-3 flex items-center gap-2 font-mono text-[12px] text-slate-300">
            <span className="text-slate-500">Suggested:</span>
            <span>{date}</span>
            <span className="text-slate-600">(Tue)</span>
          </div>
        </section>

        {scheduled ? (
          <section className="flex items-center gap-3 rounded-xl border border-status-green/40 bg-status-green/10 p-4">
            <CheckCircle2 size={18} className="shrink-0 text-status-green" aria-hidden="true" />
            <p className="text-[13px] text-status-green">
              {rec.type} scheduled for <span className="font-mono">{scheduled}</span>.
            </p>
          </section>
        ) : (
          <button
            onClick={() => schedule(date, rec.type)}
            disabled={scheduling}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-accent text-[14px] font-semibold text-bg-base disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarPlus size={18} strokeWidth={2.5} aria-hidden="true" />
            {scheduling ? 'Scheduling…' : 'Schedule Test'}
          </button>
        )}
        {scheduleErr && (
          <p className="text-center text-[12px] text-status-red">Could not schedule. Try again.</p>
        )}
      </div>
    );
  })();

  return (
    <AppShell title="Field Test" showBack>
      <div className="screen">{body}</div>
    </AppShell>
  );
}
