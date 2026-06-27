import { useQuery } from '@tanstack/react-query';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, ResponsiveContainer,
} from 'recharts';

import AppShell from '@/components/AppShell';
import { SkeletonCard } from '@/components/viz';
import { Button } from '@/components/ui/button';
import { getPowerProfile, type PowerProfile as PowerProfileData } from '@/lib/api';

const SLOTS: { secs: number; label: string }[] = [
  { secs: 5, label: '5s' },
  { secs: 60, label: '1m' },
  { secs: 300, label: '5m' },
  { secs: 1200, label: '20m' },
  { secs: 3600, label: '60m' },
];

function nearest(durations: PowerProfileData['durations'], secs: number) {
  if (!durations.length) return undefined;
  return durations.reduce((best, d) =>
    Math.abs(d.secs - secs) < Math.abs(best.secs - secs) ? d : best,
  );
}

function fmtDate(d?: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : `${dt.getMonth() + 1}/${dt.getDate()}/${String(dt.getFullYear()).slice(2)}`;
}

export default function PowerProfile() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['power-profile'],
    queryFn: getPowerProfile,
  });

  const durations = data?.durations ?? [];
  const rows = SLOTS.map(s => {
    const m = nearest(durations, s.secs);
    return { label: s.label, secs: s.secs, watts: m?.watts ?? 0, date: m?.date };
  });
  const hasData = rows.some(r => r.watts > 0);

  return (
    <AppShell title="Power Profile" showBack>
      <div className="screen">
        {isLoading && <SkeletonCard rows={5} className="h-72 rounded-2xl" />}

        {isError && (
          <div className="rounded-2xl border border-border-default bg-bg-surface p-6 text-center">
            <p className="mb-4 text-slate-400">{error instanceof Error ? error.message : 'Could not load power profile.'}</p>
            <Button onClick={() => refetch()} size="touch" className="min-w-[80px]">Retry</Button>
          </div>
        )}

        {!isLoading && !isError && !hasData && (
          <div className="rounded-2xl border border-dashed border-border-default bg-bg-surface p-8 text-center text-[13px] text-slate-400">
            No data yet.
          </div>
        )}

        {!isLoading && !isError && hasData && (
          <>
            <div className="rounded-2xl border border-border-default bg-bg-surface p-3">
              <div className="h-72 w-full" aria-label="Power profile radar: best efforts by duration">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={rows} margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                    <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.4} />
                    <PolarAngleAxis dataKey="label" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                    <PolarRadiusAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} />
                    <Radar name="Best watts" dataKey="watts" stroke="#f97316" fill="#f97316" fillOpacity={0.35} strokeWidth={2} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => [`${Math.round(Number(v))} W`, 'Best']}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-center text-[11px] text-slate-400">Best efforts (last 90 days)</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-surface">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border-subtle text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Duration</th>
                    <th className="px-4 py-2.5 text-right font-medium">Best</th>
                    <th className="px-4 py-2.5 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.label} className="border-b border-border-subtle last:border-0">
                      <td className="px-4 py-2.5 text-slate-300">{r.label}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-100">
                        {r.watts > 0 ? `${Math.round(r.watts)} W` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-400">{fmtDate(r.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
