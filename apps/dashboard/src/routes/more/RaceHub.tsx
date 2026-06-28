import { useQuery } from '@tanstack/react-query';

import AppShell from '@/components/AppShell';
import { callMcpText } from '@/lib/api';
import { DetailSkeleton, DetailError, DetailEmpty, SectionLabel } from './_shared';

/** Find the soonest future date mentioned in the text, if any. */
function nextRaceDate(text: string): Date | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const iso = [...text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)].map((m) => new Date(`${m[0]}T00:00:00`));
  const named = [...text.matchAll(/\b([A-Z][a-z]{2,8})\s+(\d{1,2}),?\s+(\d{4})\b/g)]
    .map((m) => new Date(`${m[1]} ${m[2]}, ${m[3]}`));
  const all = [...iso, ...named].filter((d) => !isNaN(d.getTime()));
  const future = all.filter((d) => d >= today).sort((a, b) => a.getTime() - b.getTime());
  return future[0] ?? null;
}

function daysTo(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

function Countdown({ date }: { date: Date }) {
  const d = daysTo(date);
  return (
    <div className="aura-glass flex flex-col items-center gap-1 rounded-2xl p-6" style={{ boxShadow: 'var(--glow-accent)' }}>
      <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-accent">A-Race Countdown</p>
      <p className="m-0 font-mono text-6xl font-bold text-accent">{d}</p>
      <p className="m-0 text-[13px] text-slate-400">days to go</p>
      <p className="m-0 text-[12px] text-slate-500">{date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
    </div>
  );
}

export default function RaceHub() {
  const races = useQuery({ queryKey: ['race-reports'], queryFn: () => callMcpText('query_race_reports') });

  return (
    <AppShell title="Race Hub" showBack>
      {races.isLoading && <DetailSkeleton label="races" />}
      {races.isError && <DetailError error={races.error} onRetry={() => races.refetch()} />}
      {!races.isLoading && !races.isError && (() => {
        const text = races.data;
        if (!text) {
          return <DetailEmpty title="No races yet" body="No races yet. First one's coming." />;
        }
        const next = nextRaceDate(text);
        return (
          <div className="flex flex-col gap-4 p-4 pb-20">
            {next && <Countdown date={next} />}
            <div className="rounded-2xl border border-border-subtle bg-bg-surface p-4">
              <SectionLabel>{next ? 'Coming up & past races' : 'Race reports'}</SectionLabel>
              <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-slate-300">{text}</pre>
            </div>
          </div>
        );
      })()}
    </AppShell>
  );
}
