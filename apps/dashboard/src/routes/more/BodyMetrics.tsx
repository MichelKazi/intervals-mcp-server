import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceArea,
} from 'recharts';

import AppShell from '@/components/AppShell';
import { getWellness, callMcpText } from '@/lib/api';
import type { WellnessDay } from '@/lib/types';
import {
  DetailSkeleton, DetailError, DetailEmpty, SectionLabel, shortDate, dateRange,
} from './_shared';

interface WeightPoint {
  date: string;
  avg: number;
}

/** 7-day trailing rolling average of logged weight. Never plots daily values. */
function rollingWeight(days: WellnessDay[]): WeightPoint[] {
  const logged = days
    .map((d) => ({ id: d.id, w: d.weight as number | null }))
    .filter((d): d is { id: string; w: number } => typeof d.w === 'number' && d.w > 0);
  if (logged.length === 0) return [];
  return logged.map((d, i) => {
    const window = logged.slice(Math.max(0, i - 6), i + 1);
    const avg = window.reduce((s, x) => s + x.w, 0) / window.length;
    return { date: shortDate(d.id), avg: Math.round(avg * 10) / 10 };
  });
}

/** Pull "FTP: 290W" from the athlete profile text. */
function parseFtp(athlete: string | null | undefined): number | null {
  if (!athlete) return null;
  const m = athlete.match(/FTP:\s*(\d+)\s*W/i);
  return m ? Number(m[1]) : null;
}

export default function BodyMetrics() {
  const { oldest, newest } = dateRange(90);
  const wellness = useQuery({ queryKey: ['wellness', oldest, newest], queryFn: () => getWellness(oldest, newest) });
  const athlete = useQuery({ queryKey: ['athlete'], queryFn: () => callMcpText('get_athlete') });

  return (
    <AppShell title="Body Metrics" showBack>
      {wellness.isLoading && <DetailSkeleton label="body metrics" />}
      {wellness.isError && <DetailError error={wellness.error} onRetry={() => wellness.refetch()} />}
      {!wellness.isLoading && !wellness.isError && (() => {
        const points = rollingWeight(wellness.data ?? []);
        const ftp = parseFtp(athlete.data);
        const latest = points[points.length - 1]?.avg ?? null;
        const wkg = latest && ftp ? ftp / latest : null;
        const min = points.length ? Math.min(...points.map((p) => p.avg)) : 0;
        const max = points.length ? Math.max(...points.map((p) => p.avg)) : 0;

        if (points.length === 0) {
          return <DetailEmpty title="No weight data" body="No weight logged. Sync a scale or log weight in intervals.icu." />;
        }

        return (
          <div className="flex flex-col gap-4 p-4 pb-20">
            <div className="aura-glass flex items-baseline justify-between rounded-2xl p-4" style={{ boxShadow: 'var(--glow-accent)' }}>
              <div>
                <p className="m-0 text-[10px] font-semibold uppercase tracking-widest text-accent">Current W/kg</p>
                <p className="m-0 mt-1 font-mono text-3xl font-semibold text-slate-100">
                  {wkg != null ? wkg.toFixed(2) : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="m-0 text-[11px] text-slate-500">7-day avg weight</p>
                <p className="m-0 font-mono text-xl text-slate-200">{latest != null ? `${latest.toFixed(1)}` : '—'}</p>
                {ftp != null && <p className="m-0 text-[11px] text-slate-500">FTP {ftp}W</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-surface p-4">
              <SectionLabel>Weight — 7-day rolling average</SectionLabel>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#2a2a3c" vertical={false} />
                    <ReferenceArea y1={min} y2={max} fill="var(--z3)" fillOpacity={0.04} />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} interval="preserveStartEnd" minTickGap={28} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={36} domain={[Math.floor(min - 1), Math.ceil(max + 1)]} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3c', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#94a3b8' }}
                      itemStyle={{ color: 'var(--z3)' }}
                      formatter={(v) => [`${v}`, 'avg']}
                    />
                    <Line type="monotone" dataKey="avg" stroke="var(--z3)" strokeWidth={2} dot={false} name="7-day avg" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 px-1 text-[11px] text-slate-500">
                Range <span className="font-mono">{min.toFixed(1)}</span>–<span className="font-mono">{max.toFixed(1)}</span> over {points.length} logged days.
              </p>
            </div>
          </div>
        );
      })()}
    </AppShell>
  );
}
