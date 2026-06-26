import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

import AppShell from '@/components/AppShell';
import { MetricRing } from '@/components/viz';
import { getWellness, callMcpText } from '@/lib/api';
import type { WellnessDay } from '@/lib/types';
import {
  DetailSkeleton, DetailError, DetailEmpty, SectionLabel, readinessColor, shortDate, dateRange,
} from './_shared';

function hoursFromSecs(secs?: number | null): number | null {
  return secs != null && secs > 0 ? secs / 3600 : null;
}

/** Latest day carrying any sleep data. */
function latestSleep(days: WellnessDay[]): WellnessDay | null {
  return [...days].reverse().find((d) => d.sleepScore != null || (d.sleepSecs as number) > 0) ?? null;
}

function NightBars({ days }: { days: WellnessDay[] }) {
  const last14 = days.slice(-14);
  const hours = last14.map((d) => hoursFromSecs(d.sleepSecs as number) ?? 0);
  const max = Math.max(8, ...hours);
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-surface p-4">
      <SectionLabel>Last 14 nights</SectionLabel>
      <div className="flex items-stretch gap-1" style={{ height: 88 }} role="img" aria-label="Sleep duration, last 14 nights">
        {last14.map((d, i) => {
          const h = hours[i];
          const pct = max > 0 ? (h / max) * 100 : 0;
          return (
            <div key={d.id} className="flex flex-1 flex-col items-center justify-end" title={`${shortDate(d.id)}: ${h.toFixed(1)}h`}>
              <div
                className="w-full rounded-t-sm bg-zone-1"
                style={{ height: `${Math.max(pct, 2)}%`, opacity: h > 0 ? 1 : 0.25 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
        <span>{shortDate(last14[0]?.id ?? '')}</span>
        <span className="font-mono">{(hours.filter(Boolean).reduce((a, b) => a + b, 0) / (hours.filter(Boolean).length || 1)).toFixed(1)}h avg</span>
        <span>{shortDate(last14[last14.length - 1]?.id ?? '')}</span>
      </div>
    </div>
  );
}

function TrendLine({ days, field, label, color }: { days: WellnessDay[]; field: 'hrv' | 'restingHR'; label: string; color: string }) {
  const data = days
    .slice(-30)
    .filter((d) => d[field] != null)
    .map((d) => ({ date: shortDate(d.id), value: d[field] as number }));
  if (data.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-surface p-4">
      <SectionLabel>{label}</SectionLabel>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="#2a2a3c" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} interval="preserveStartEnd" minTickGap={28} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={32} domain={['dataMin - 4', 'dataMax + 4']} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3c', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color }}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} name={label} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RecoveryCallout({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-surface p-4">
      <SectionLabel>Recovery patterns</SectionLabel>
      <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-300">{text}</pre>
    </div>
  );
}

export default function Sleep() {
  const { oldest, newest } = dateRange(42);
  const wellness = useQuery({ queryKey: ['wellness', oldest, newest], queryFn: () => getWellness(oldest, newest) });
  const recovery = useQuery({ queryKey: ['recovery-patterns'], queryFn: () => callMcpText('get_recovery_patterns') });

  return (
    <AppShell title="Sleep" showBack>
      {wellness.isLoading && <DetailSkeleton label="sleep" />}
      {wellness.isError && <DetailError error={wellness.error} onRetry={() => wellness.refetch()} />}
      {!wellness.isLoading && !wellness.isError && (() => {
        const days = wellness.data ?? [];
        const latest = latestSleep(days);
        if (!latest) {
          return <DetailEmpty title="No sleep data" body="No sleep data — check Oura connection." />;
        }
        const score = (latest.sleepScore as number) ?? 0;
        return (
          <div className="flex flex-col gap-4 p-4 pb-20">
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-border-subtle bg-bg-surface p-4">
              <MetricRing value={score} max={100} color={readinessColor(score)} label="Sleep Score" size="lg" />
              <p className="text-[12px] text-slate-400">
                {((latest.sleepSecs as number) / 3600).toFixed(1)}h · {shortDate(latest.id)}
              </p>
            </div>

            <NightBars days={days} />
            <TrendLine days={days} field="hrv" label="HRV (30 days)" color="#22c55e" />
            <TrendLine days={days} field="restingHR" label="Resting HR (30 days)" color="#f97316" />

            {recovery.data && <RecoveryCallout text={recovery.data} />}
          </div>
        );
      })()}
    </AppShell>
  );
}
