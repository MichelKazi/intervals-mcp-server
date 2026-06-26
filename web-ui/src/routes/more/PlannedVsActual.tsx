import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
} from 'recharts';
import { Check, Minus, Plus } from 'lucide-react';

import AppShell from '@/components/AppShell';
import { ComplianceDot, SkeletonCard } from '@/components/viz';
import { callMcp } from '@/lib/api';

// ─── Parsing get_planned_vs_actual text ──────────────────────────────────────

type ItemStatus = 'completed' | 'partial' | 'unlogged' | 'bonus';

interface PlanItem {
  date: string;
  name: string;
  status: ItemStatus;
  plannedLoad: number | null;
  actualLoad: number | null;
}

interface WeekGroup {
  label: string;
  planned: number;
  actual: number;
}

// Lines look like:
//   ✓ 2026-06-19 Knocknam — duration: 2h49m/1h30m (188%), load: 117/107 (109%)
//   ✗ 2026-06-21 Solo Ride — MISSED
//   + 2026-06-22 Bonus Ride — load: 0/80
const LINE_RE = /^\s*([✓✗+~])\s+(\d{4}-\d{2}-\d{2})\s+(.*)$/;
const LOAD_RE = /load:\s*(\d+)\/(\d+)/;

function classify(marker: string, plannedLoad: number | null, actualLoad: number | null): ItemStatus {
  if (marker === '+') return 'bonus';
  if (marker === '✗') return 'unlogged';
  if (plannedLoad != null && actualLoad != null && plannedLoad > 0) {
    const offBy = Math.abs(actualLoad - plannedLoad) / plannedLoad;
    if (offBy > 0.25) return 'partial';
  }
  return 'completed';
}

export function parsePlannedVsActual(text: string): { items: PlanItem[] } {
  const items: PlanItem[] = [];
  for (const raw of text.split('\n')) {
    const m = raw.match(LINE_RE);
    if (!m) continue;
    const [, marker, date, rest] = m;
    const missed = /MISSED/i.test(rest);
    const loadM = rest.match(LOAD_RE);
    // text format is "actual/planned" in the load: A/P pattern for completed,
    // but MISSED lines have no load. Marker drives unlogged/bonus.
    let actualLoad: number | null = null;
    let plannedLoad: number | null = null;
    if (loadM) {
      actualLoad = Number(loadM[1]);
      plannedLoad = Number(loadM[2]);
    }
    const name = rest.split('—')[0].trim() || rest.trim();
    const status = missed ? 'unlogged' : classify(marker, plannedLoad, actualLoad);
    items.push({ date, name, status, plannedLoad, actualLoad });
  }
  return { items };
}

function isoWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function groupByWeek(items: PlanItem[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>();
  for (const it of items) {
    const wk = isoWeekStart(it.date);
    const g = map.get(wk) ?? { label: wk.slice(5), planned: 0, actual: 0 };
    if (it.plannedLoad != null) g.planned += it.plannedLoad;
    if (it.actualLoad != null) g.actual += it.actualLoad;
    map.set(wk, g);
  }
  return [...map.entries()].sort().map(([, g]) => g);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<ItemStatus, { color: string; bg: string; label: string; Icon: typeof Check }> = {
  completed: { color: 'text-status-green', bg: 'bg-status-green/15', label: 'Completed', Icon: Check },
  partial: { color: 'text-status-yellow', bg: 'bg-status-yellow/15', label: 'Partial', Icon: Minus },
  unlogged: { color: 'text-status-red', bg: 'bg-status-red/15', label: 'Unlogged', Icon: Minus },
  bonus: { color: 'text-zone-1', bg: 'bg-zone-1/15', label: 'Bonus', Icon: Plus },
};

function StatusBadge({ status }: { status: ItemStatus }) {
  const m = STATUS_META[status];
  const Icon = m.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${m.color} ${m.bg}`}
      aria-label={m.label}
    >
      <Icon size={11} strokeWidth={3} aria-hidden="true" />
      {m.label}
    </span>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlannedVsActual() {
  const q = useQuery({
    queryKey: ['planned-vs-actual'],
    queryFn: () => callMcp('get_planned_vs_actual', {}) as Promise<{ result?: string } | string>,
  });

  const body = (() => {
    if (q.isLoading) {
      return (
        <div className="space-y-3">
          <SkeletonCard rows={4} />
          <SkeletonCard rows={5} />
        </div>
      );
    }
    if (q.isError) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[13px] text-slate-400">Could not load compliance data.</p>
          <button
            onClick={() => q.refetch()}
            className="min-h-[44px] rounded-lg bg-bg-raised px-4 text-[13px] font-semibold text-slate-100"
          >
            Retry
          </button>
        </div>
      );
    }

    const text = typeof q.data === 'string' ? q.data : q.data?.result ?? '';
    const { items } = parsePlannedVsActual(text);

    if (items.length === 0) {
      return (
        <p className="py-12 text-center text-[13px] text-slate-400">
          No planned workouts in this window.
        </p>
      );
    }

    const weeks = groupByWeek(items);
    const chartData = weeks.map((w) => ({ week: w.label, Planned: w.planned, Actual: w.actual }));

    return (
      <div className="space-y-4">
        <section className="rounded-xl border border-border-default bg-bg-surface p-4">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-slate-500">
            Planned vs Actual TSS
          </h2>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a3c', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  cursor={{ fill: '#ffffff10' }}
                />
                <Bar dataKey="Planned" radius={[3, 3, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill="#3a3a50" />)}
                </Bar>
                <Bar dataKey="Actual" radius={[3, 3, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill="#f97316" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-border-strong" /> Planned</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Actual</span>
          </div>
        </section>

        <section className="rounded-xl border border-border-default bg-bg-surface p-4">
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-slate-500">
            Planned Workouts
          </h2>
          <ul className="space-y-2.5">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-3" data-testid="plan-item">
                <ComplianceDot planned={it.plannedLoad} actual={it.actualLoad} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-slate-100">{it.name}</div>
                  <div className="font-mono text-[11px] text-slate-500">
                    {it.date}
                    {it.plannedLoad != null && (
                      <> · {it.actualLoad ?? 0}/{it.plannedLoad} TSS</>
                    )}
                  </div>
                </div>
                <StatusBadge status={it.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  })();

  return (
    <AppShell title="Planned vs Actual" showBack>
      <div className="px-4 pb-20 pt-4">{body}</div>
    </AppShell>
  );
}
