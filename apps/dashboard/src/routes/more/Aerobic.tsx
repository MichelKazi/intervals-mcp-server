import { useQuery } from '@tanstack/react-query';

import AppShell from '@/components/AppShell';
import { SkeletonCard } from '@/components/viz';
import { Button } from '@/components/ui/button';
import { callMcp } from '@/lib/api';

function mcpText(r: unknown): string {
  if (typeof r === 'string') return r;
  if (r && typeof r === 'object' && 'result' in r) return String((r as { result: unknown }).result ?? '');
  return String(r ?? '');
}

// First line that reads like a recommendation / verdict, for the summary banner.
function interpretation(text: string): string | null {
  const m = text.match(/(?:Rec(?:ommendation)?|Trend|Assessment)\s*:?\s*(.+)/i);
  return m ? m[1].trim() : null;
}

export default function Aerobic() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['mcp', 'get_aerobic_development'],
    queryFn: () => callMcp('get_aerobic_development', {}),
  });

  const text = data != null ? mcpText(data) : '';
  const summary = text ? interpretation(text) : null;
  const empty = !text.trim() || /no activities|insufficient/i.test(text);

  return (
    <AppShell title="Aerobic Development" showBack>
      <div className="screen">
        {isLoading && <SkeletonCard rows={6} className="rounded-2xl" />}

        {isError && (
          <div className="rounded-2xl border border-border-default bg-bg-surface p-6 text-center">
            <p className="mb-4 text-slate-400">{error instanceof Error ? error.message : 'Could not load aerobic analysis.'}</p>
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
            {summary && (
              <div className="aura-glass rounded-2xl border-accent/40 px-4 py-3" style={{ boxShadow: 'var(--glow-accent)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">Coach read</p>
                <p className="mt-0.5 text-[14px] text-slate-100">{summary}</p>
              </div>
            )}
            <div className="rounded-2xl border border-border-default bg-bg-surface p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Decoupling analysis
              </p>
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
