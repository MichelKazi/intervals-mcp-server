import { useQuery } from '@tanstack/react-query';
import {
  ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts';

import AppShell from '@/components/AppShell';
import { SkeletonCard } from '@/components/viz';
import { Button } from '@/components/ui/button';
import { getVolume, getWeeklyVolume, type VolumePoint, type WeeklyVolumePoint } from '@/lib/api';

// Activity type → color. Ride is the primary (accent); others get distinct hues.
const TYPE_COLORS: Record<string, string> = {
  Ride: '#f97316',
  VirtualRide: '#eab308',
  Run: '#3b82f6',
  Swim: '#a855f7',
  Workout: '#22c55e',
};
function typeColor(t: string): string {
  return TYPE_COLORS[t] ?? '#64748b';
}

function shortDate(d: string): string {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

export default function Volume() {
  const scatter = useQuery({ queryKey: ['volume', 90], queryFn: () => getVolume(90) });
  const weekly = useQuery({ queryKey: ['weekly-volume', 12], queryFn: () => getWeeklyVolume(12) });

  const pts: VolumePoint[] = scatter.data ?? [];
  const weeks: WeeklyVolumePoint[] = weekly.data ?? [];
  const isLoading = scatter.isLoading || weekly.isLoading;
  const isError = scatter.isError || weekly.isError;
  const err = scatter.error ?? weekly.error;

  // Map dates to numeric x for the scatter (recharts number axis), keep label map.
  const scatterData = pts
    .filter(p => p.tss != null && p.duration_secs != null)
    .map(p => ({ x: new Date(p.date).getTime(), tss: p.tss, size: Math.max(40, p.duration_secs / 36), type: p.type, date: p.date }));
  const types = Array.from(new Set(scatterData.map(d => d.type)));
  const hasScatter = scatterData.length > 0;
  const hasWeekly = weeks.length > 0;

  return (
    <AppShell title="Volume" showBack>
      <div className="screen">
        {isLoading && <SkeletonCard rows={5} className="h-72 rounded-2xl" />}

        {isError && (
          <div className="rounded-2xl border border-border-default bg-bg-surface p-6 text-center">
            <p className="mb-4 text-slate-400">{err instanceof Error ? err.message : 'Could not load volume data.'}</p>
            <Button onClick={() => { scatter.refetch(); weekly.refetch(); }} size="touch" className="min-w-[80px]">Retry</Button>
          </div>
        )}

        {!isLoading && !isError && !hasScatter && !hasWeekly && (
          <div className="rounded-2xl border border-dashed border-border-default bg-bg-surface p-8 text-center text-[13px] text-slate-400">
            No data yet.
          </div>
        )}

        {!isLoading && !isError && (hasScatter || hasWeekly) && (
          <>
            {hasScatter && (
              <div className="rounded-2xl border border-border-default bg-bg-surface p-3">
                <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-widest text-accent">Per-session load (90d)</p>
                <div className="h-64 w-full" aria-label="Volume scatter: training load per session over time, dot size by duration">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} />
                      <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']} scale="time"
                        tickFormatter={(t) => shortDate(new Date(t).toISOString())}
                        tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={40} />
                      <YAxis type="number" dataKey="tss" name="TSS" tick={{ fill: '#94a3b8', fontSize: 10 }}
                        axisLine={false} tickLine={false} width={36} />
                      <ZAxis type="number" dataKey="size" range={[40, 400]} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, n) => n === 'TSS' ? [Math.round(Number(v)), 'TSS'] : [v, n]}
                        labelFormatter={() => ''}
                      />
                      <Scatter data={scatterData} name="Sessions">
                        {scatterData.map((d, i) => (
                          <Cell key={i} fill={typeColor(d.type)} fillOpacity={0.7} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-400">
                  {types.map(t => (
                    <span key={t} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: typeColor(t) }} />{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {hasWeekly && (
              <div className="rounded-2xl border border-border-default bg-bg-surface p-3">
                <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-widest text-accent">Weekly hours (12w)</p>
                <div className="h-56 w-full" aria-label="Weekly training hours bar chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeks} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                      <XAxis dataKey="week_start" tickFormatter={shortDate} tick={{ fill: '#94a3b8', fontSize: 10 }}
                        axisLine={false} tickLine={false} minTickGap={20} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                        labelFormatter={(l) => `Week of ${shortDate(String(l))}`}
                        formatter={(v) => [`${Math.round(Number(v) * 10) / 10} h`, 'Hours']}
                      />
                      <Bar dataKey="hours" name="Hours" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
