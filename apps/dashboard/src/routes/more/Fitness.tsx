import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

import AppShell from '@/components/AppShell';
import { SkeletonCard } from '@/components/viz';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { getPmc, type PmcPoint } from '@/lib/api';

const PERIODS = [
  { key: '4w', label: '4W', days: 28 },
  { key: '8w', label: '8W', days: 56 },
  { key: '12w', label: '12W', days: 84 },
  { key: 'all', label: 'All', days: 365 },
] as const;

function shortDate(d: string): string {
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function rampBadge(ramp: number | null) {
  if (ramp == null) return null;
  const r = Math.round(ramp * 10) / 10;
  let cls = 'text-status-green bg-status-green/15';
  let note = 'sustainable';
  if (r > 8) { cls = 'text-status-red bg-status-red/15'; note = 'aggressive'; }
  else if (r > 5) { cls = 'text-status-yellow bg-status-yellow/15'; note = 'high'; }
  else if (r < -5) { cls = 'text-status-yellow bg-status-yellow/15'; note = 'detraining'; }
  return (
    <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${cls}`}>
      Ramp <span className="font-mono">{r > 0 ? '+' : ''}{r}</span>/wk · {note}
    </span>
  );
}

export default function Fitness() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(PERIODS[1]);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pmc', period.days],
    queryFn: () => getPmc(period.days),
  });

  const pts: PmcPoint[] = data ?? [];
  const latest = pts.length ? pts[pts.length - 1] : null;
  const ramp = latest?.rampRate ?? null;

  return (
    <AppShell title="Fitness" showBack>
      <div className="screen">
        <Tabs value={period.key} onValueChange={(v) => setPeriod(PERIODS.find(p => p.key === v) ?? PERIODS[1])}>
          <TabsList className="grid w-full grid-cols-4">
            {PERIODS.map(p => (
              <TabsTrigger
                key={p.key}
                value={p.key}
                className="data-[state=active]:shadow-[var(--glow-accent)]"
              >
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading && <SkeletonCard rows={5} className="h-72 rounded-2xl" />}

        {isError && (
          <div className="rounded-2xl border border-border-default bg-bg-surface p-6 text-center">
            <p className="mb-4 text-slate-400">{error instanceof Error ? error.message : 'Could not load fitness data.'}</p>
            <Button onClick={() => refetch()} size="touch" className="min-w-[80px]">Retry</Button>
          </div>
        )}

        {!isLoading && !isError && pts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border-default bg-bg-surface p-8 text-center text-[13px] text-slate-400">
            No data yet.
          </div>
        )}

        {!isLoading && !isError && pts.length > 0 && (
          <>
            <div className="aura-glass flex flex-wrap items-center gap-2 rounded-2xl p-3">
              {rampBadge(ramp)}
              {latest && (
                <>
                  <span className="rounded-full bg-bg-raised px-2.5 py-1 text-[12px] text-slate-300">
                    CTL <span className="font-mono text-zone-1">{Math.round(latest.ctl)}</span>
                  </span>
                  <span className="rounded-full bg-bg-raised px-2.5 py-1 text-[12px] text-slate-300">
                    ATL <span className="font-mono text-accent">{Math.round(latest.atl)}</span>
                  </span>
                  <span className="rounded-full bg-bg-raised px-2.5 py-1 text-[12px] text-slate-300">
                    Form <span className={`font-mono ${latest.tsb >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                      {latest.tsb > 0 ? '+' : ''}{Math.round(latest.tsb)}
                    </span>
                  </span>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-border-default bg-bg-surface p-3" style={{ boxShadow: 'var(--glow-accent)' }}>
              <div className="h-72 w-full" aria-label="Performance management chart: fitness, fatigue, and form over time">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pts} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#94a3b8', fontSize: 10 }}
                      minTickGap={32} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="load" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                    <YAxis yAxisId="form" orientation="right" hide />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(l) => shortDate(String(l))}
                      formatter={(v, n) => [Math.round(Number(v)), n]}
                    />
                    <ReferenceLine yAxisId="form" y={0} stroke="#475569" strokeDasharray="3 3" />
                    <Area yAxisId="form" type="monotone" dataKey="tsb" name="Form (TSB)"
                      stroke="none" fill="#22c55e" fillOpacity={0.18} />
                    <Line yAxisId="load" type="monotone" dataKey="ctl" name="Fitness (CTL)"
                      stroke="var(--z1)" strokeWidth={2} dot={false} />
                    <Line yAxisId="load" type="monotone" dataKey="atl" name="Fatigue (ATL)"
                      stroke="var(--z3)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-zone-1" />Fitness (CTL)</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-zone-3" />Fatigue (ATL)</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-status-green/40" />Form (TSB)</span>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
