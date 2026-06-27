import { useQuery } from '@tanstack/react-query';
import { Check, X, Minus } from 'lucide-react';

import AppShell from '@/components/AppShell';
import { getActivities } from '@/lib/api';
import type { Activity } from '@/lib/types';
import { DetailSkeleton, DetailError, SectionLabel, dateRange } from './_shared';

type Status = 'green' | 'yellow' | 'red' | 'unknown';

interface Indicator {
  label: string;
  status: Status;
  evidence: string;
}

const STATUS_META: Record<Status, { color: string; Icon: typeof Check; aria: string }> = {
  green: { color: '#22c55e', Icon: Check, aria: 'ready' },
  yellow: { color: '#f59e0b', Icon: Minus, aria: 'partial' },
  red: { color: '#ef4444', Icon: X, aria: 'not ready' },
  unknown: { color: '#64748b', Icon: Minus, aria: 'needs data' },
};

function watts(a: Activity): number | null {
  const w = (a.icu_weighted_avg_watts as number) ?? (a.icu_average_watts as number);
  return typeof w === 'number' && w > 0 ? w : null;
}
function ftpOf(a: Activity): number {
  return (a.icu_ftp as number) ?? 290;
}
function pctFtp(a: Activity): number | null {
  const w = watts(a);
  return w ? (w / ftpOf(a)) * 100 : null;
}

/** Derive four race-readiness checks from recent ride power, honestly labeling gaps. */
function evaluate(rides: Activity[]): Indicator[] {
  const withPower = rides.filter((a) => watts(a) != null && (a.moving_time as number) > 0);

  // 1. Hold 95–100% FTP for 20min — proxy: a ride with NP >= 90% FTP lasting >= 20min.
  const threshold = withPower.find((a) => (pctFtp(a) ?? 0) >= 90 && (a.moving_time as number) >= 1200);
  const ind1: Indicator = threshold
    ? { label: 'Hold 95–100% FTP for 20 min', status: (pctFtp(threshold) ?? 0) >= 95 ? 'green' : 'yellow',
        evidence: `${threshold.name}: ${Math.round(pctFtp(threshold)!)}% FTP weighted` }
    : { label: 'Hold 95–100% FTP for 20 min', status: 'unknown', evidence: 'No threshold-effort ride in range — needs data.' };

  // 2. Repeat 30s surges 130%+ — needs interval peaks we don't carry per-activity.
  const surge = withPower.find((a) => (a.max_watts as number) && (a.max_watts as number) / ftpOf(a) >= 1.3);
  const ind2: Indicator = surge
    ? { label: 'Repeat 30s surges 130%+', status: 'green', evidence: `${surge.name}: peak ${Math.round(((surge.max_watts as number) / ftpOf(surge)) * 100)}% FTP` }
    : { label: 'Repeat 30s surges 130%+', status: 'unknown', evidence: 'No surge peak data available — needs data.' };

  // 3. Mixed 60–90min, no fade — proxy: a 60–90min ride at solid intensity.
  const mixed = withPower.find((a) => {
    const t = a.moving_time as number;
    return t >= 3600 && t <= 5400 && (pctFtp(a) ?? 0) >= 75;
  });
  const ind3: Indicator = mixed
    ? { label: 'Mixed 60–90 min, no fade', status: (pctFtp(mixed) ?? 0) >= 85 ? 'green' : 'yellow',
        evidence: `${mixed.name}: ${Math.round((mixed.moving_time as number) / 60)} min @ ${Math.round(pctFtp(mixed)!)}% FTP` }
    : { label: 'Mixed 60–90 min, no fade', status: 'unknown', evidence: 'No 60–90 min effort in range — needs data.' };

  // 4. Sprint power stable — needs repeated sprint peaks; surface best peak as evidence only.
  const sprint = withPower.filter((a) => a.max_watts != null).sort((a, b) => (b.max_watts as number) - (a.max_watts as number))[0];
  const ind4: Indicator = sprint
    ? { label: 'Sprint power stable', status: 'yellow', evidence: `Best peak ${Math.round(sprint.max_watts as number)}W — single sample, stability unconfirmed.` }
    : { label: 'Sprint power stable', status: 'unknown', evidence: 'No sprint peak data available — needs data.' };

  return [ind1, ind2, ind3, ind4];
}

function IndicatorRow({ ind }: { ind: Indicator }) {
  const { color, Icon, aria } = STATUS_META[ind.status];
  return (
    <div className="flex items-start gap-3 border-b border-border-subtle py-3 last:border-0">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${color}22` }}
        role="img"
        aria-label={`${ind.label}: ${aria}`}
      >
        <Icon size={16} style={{ color }} strokeWidth={2.5} />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[14px] font-medium text-slate-100">{ind.label}</p>
        <p className="m-0 mt-0.5 text-[12px] text-slate-400">{ind.evidence}</p>
        <span className="mt-0.5 inline-block text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>
          {aria}
        </span>
      </div>
    </div>
  );
}

export default function RaceReadiness() {
  const { oldest, newest } = dateRange(42);
  const activities = useQuery({
    queryKey: ['activities', oldest, newest],
    queryFn: () => getActivities({ oldest, newest, limit: 60 }),
  });

  return (
    <AppShell title="Race Readiness" showBack>
      {activities.isLoading && <DetailSkeleton label="race readiness" />}
      {activities.isError && <DetailError error={activities.error} onRetry={() => activities.refetch()} />}
      {!activities.isLoading && !activities.isError && (() => {
        const rides = (activities.data ?? []).filter(
          (a) => a.source !== 'STRAVA' && !a._note && (a.type === 'Ride' || a.type === 'VirtualRide'),
        );
        const indicators = evaluate(rides);
        return (
          <div className="flex flex-col gap-4 p-4 pb-20">
            <div className="rounded-2xl border border-border-subtle bg-bg-surface p-4">
              <SectionLabel>Race-specific checks (last 6 weeks)</SectionLabel>
              {indicators.map((ind) => <IndicatorRow key={ind.label} ind={ind} />)}
            </div>
            <p className="px-1 text-[11px] text-slate-500">
              Derived from recent ride power. Checks lacking interval-level data are marked needs data rather than assumed pass.
            </p>
          </div>
        );
      })()}
    </AppShell>
  );
}
