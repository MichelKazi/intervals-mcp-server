import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

import AppShell from '@/components/AppShell';
import { SkeletonCard } from '@/components/viz';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { getZoneDistribution } from '@/lib/api';

const PERIODS = [
  { key: 'week', label: 'This Week', api: '1w' },
  { key: '4w', label: '4W', api: '4w' },
  { key: '12w', label: '12W', api: '12w' },
] as const;

// Power-zone palette (Coggan 7-zone). First five align with the zone-1..5 tokens.
const ZONE_COLOR: Record<string, string> = {
  Z1: 'var(--z1)', Z2: '#22c55e', Z3: 'var(--z2)', Z4: 'var(--z3)', Z5: 'var(--z4)', Z6: 'var(--z5)', Z7: '#ec4899',
};
const ZONE_NAME: Record<string, string> = {
  Z1: 'Recovery', Z2: 'Endurance', Z3: 'Tempo', Z4: 'Threshold', Z5: 'VO2max', Z6: 'Anaerobic', Z7: 'Neuromuscular',
};
function zColor(z: string) { return ZONE_COLOR[z] ?? '#64748b'; }

function fmtHrs(secs: number): string {
  const h = secs / 3600;
  return h >= 1 ? `${Math.round(h * 10) / 10}h` : `${Math.round(secs / 60)}m`;
}

export default function ZoneDistribution() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(PERIODS[1]);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['zone-distribution', period.api],
    queryFn: () => getZoneDistribution(period.api),
  });

  const zones = (data?.zones ?? []).filter(z => z.seconds > 0);
  const hasData = zones.length > 0;

  return (
    <AppShell title="Zone Distribution" showBack>
      <div className="screen">
        <Tabs value={period.key} onValueChange={(v) => setPeriod(PERIODS.find(p => p.key === v) ?? PERIODS[1])}>
          <TabsList className="grid w-full grid-cols-3">
            {PERIODS.map(p => <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        {isLoading && <SkeletonCard rows={5} className="h-72 rounded-2xl" />}

        {isError && (
          <div className="rounded-2xl border border-border-default bg-bg-surface p-6 text-center">
            <p className="mb-4 text-slate-400">{error instanceof Error ? error.message : 'Could not load zone distribution.'}</p>
            <Button onClick={() => refetch()} size="touch" className="min-w-[80px]">Retry</Button>
          </div>
        )}

        {!isLoading && !isError && !hasData && (
          <div className="rounded-2xl border border-dashed border-border-default bg-bg-surface p-8 text-center text-[13px] text-slate-400">
            No data yet.
          </div>
        )}

        {!isLoading && !isError && hasData && (
          <div className="rounded-2xl border border-border-default bg-bg-surface p-3">
            <div className="h-64 w-full" aria-label="Zone distribution donut: time in each training zone">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={zones} dataKey="seconds" nameKey="zone" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={95} paddingAngle={2} stroke="none">
                    {zones.map((z) => <Cell key={z.zone} fill={zColor(z.zone)} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                    formatter={(v, _n, p) => {
                      const z = (p as { payload?: { zone?: string; pct?: number } })?.payload;
                      return [`${fmtHrs(Number(v))} (${Math.round(z?.pct ?? 0)}%)`, (z?.zone && ZONE_NAME[z.zone]) || z?.zone || ''];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <ul className="mt-3 flex flex-col gap-2">
              {zones.map(z => (
                <li key={z.zone} className="flex items-center gap-3 text-[13px]">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: zColor(z.zone) }} />
                  <span className="text-slate-300">{z.zone} · {ZONE_NAME[z.zone] ?? ''}</span>
                  <span className="ml-auto font-mono text-slate-400">{fmtHrs(z.seconds)}</span>
                  <span className="w-12 text-right font-mono text-slate-100">{Math.round(z.pct)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
