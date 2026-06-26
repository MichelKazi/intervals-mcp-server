import { useQuery } from '@tanstack/react-query';

import AppShell from '@/components/AppShell';
import { SkeletonCard, MetricRing } from '@/components/viz';
import { Button } from '@/components/ui/button';
import { callMcp } from '@/lib/api';

function mcpText(r: unknown): string {
  if (typeof r === 'string') return r;
  if (r && typeof r === 'object' && 'result' in r) return String((r as { result: unknown }).result ?? '');
  return String(r ?? '');
}

function num(text: string, re: RegExp): number | null {
  const m = text.match(re);
  return m ? Number(m[1]) : null;
}

// ACWR risk band → ring color + label.
function acwrBand(acwr: number | null) {
  if (acwr == null) return { color: '#64748b', label: 'unknown' };
  if (acwr < 0.8) return { color: '#eab308', label: 'undertrained' };
  if (acwr <= 1.3) return { color: '#22c55e', label: 'sweet spot' };
  if (acwr <= 1.5) return { color: '#f97316', label: 'caution' };
  return { color: '#ef4444', label: 'danger' };
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex-1 rounded-xl border border-border-default bg-bg-surface px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg text-slate-100">{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export default function FatigueRisk() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['mcp', 'get_fatigue_risk'],
    queryFn: () => callMcp('get_fatigue_risk', {}),
  });

  const text = data != null ? mcpText(data) : '';
  const empty = !text.trim() || /no activities|insufficient/i.test(text);

  const acwr = num(text, /ACWR[:\s]+([0-9.]+)/i);
  const monotony = num(text, /monotony[:\s]+([0-9.]+)/i);
  const strain = num(text, /strain[:\s]+([0-9.]+)/i);
  const band = acwrBand(acwr);

  return (
    <AppShell title="Fatigue Risk" showBack>
      <div className="flex flex-col gap-4 px-4 pb-20 pt-4">
        {isLoading && <SkeletonCard rows={6} className="rounded-2xl" />}

        {isError && (
          <div className="rounded-2xl border border-border-default bg-bg-surface p-6 text-center">
            <p className="mb-4 text-slate-400">{error instanceof Error ? error.message : 'Could not load fatigue risk.'}</p>
            <Button onClick={() => refetch()} size="touch" className="min-w-[80px]">Retry</Button>
          </div>
        )}

        {!isLoading && !isError && empty && (
          <div className="rounded-2xl border border-dashed border-border-default bg-bg-surface p-8 text-center text-[13px] text-slate-400">
            {text.trim() ? text : 'No data yet.'}
          </div>
        )}

        {!isLoading && !isError && !empty && (
          <>
            {acwr != null && (
              <div className="flex items-center gap-4 rounded-2xl border border-border-default bg-bg-surface p-4">
                <MetricRing value={acwr} max={2} color={band.color} label="ACWR" size="md" />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold capitalize" style={{ color: band.color }}>{band.label}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                    Acute:chronic load ratio. Sweet spot is 0.8–1.3; above 1.5 flags rapid overload.
                  </p>
                </div>
              </div>
            )}

            {(monotony != null || strain != null) && (
              <div className="flex gap-3">
                {monotony != null && <StatCard label="Monotony" value={String(monotony)} hint={monotony > 2 ? 'high — vary load' : 'ok'} />}
                {strain != null && <StatCard label="Strain" value={String(Math.round(strain))} hint="load × monotony" />}
              </div>
            )}

            <div className="rounded-2xl border border-border-default bg-bg-surface p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Full report</p>
              <pre className="overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed text-slate-300">
                {text}
              </pre>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
