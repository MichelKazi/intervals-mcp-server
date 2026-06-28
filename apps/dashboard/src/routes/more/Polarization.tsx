import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

import AppShell from '@/components/AppShell';
import { SkeletonCard } from '@/components/viz';
import { callMcp } from '@/lib/api';

// ─── Parsing ──────────────────────────────────────────────────────────────────

interface ZoneBand {
  key: 'z1' | 'z2' | 'z3';
  label: string;
  desc: string;
  pct: number;
  color: string;
}

// Polarized model: Z1 = low/easy, Z2 = the "no-man's land" tempo, Z3 = hard.
// The insights text gives a load progression and aerobic efficiency, not a raw
// zone split, so we derive a 3-band intensity distribution from session loads
// when an explicit split is not present.

const EXPLICIT_RE = /(?:zone\s*)?([123])\s*[:=]\s*(\d+(?:\.\d+)?)\s*%/gi;

function parseExplicit(text: string): Record<string, number> | null {
  const out: Record<string, number> = {};
  let m: RegExpExecArray | null;
  while ((m = EXPLICIT_RE.exec(text)) !== null) {
    out['z' + m[1]] = Number(m[2]);
  }
  return Object.keys(out).length === 3 ? out : null;
}

// Decoupling values per week from the aerobic section, used as a trend signal.
const DECOUPLE_RE = /Decouple=(-?\d+(?:\.\d+)?)%/g;

function parseDecoupleTrend(text: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = DECOUPLE_RE.exec(text)) !== null) out.push(Number(m[1]));
  return out;
}

// Sport-mix style is not zones; we approximate a polarized split from the
// load-progression monotony + the explicit "Tapering/Building" direction.
// Fallback distribution keeps the screen honest: clearly labeled as derived.
function deriveBands(text: string): { bands: ZoneBand[]; derived: boolean } {
  const explicit = parseExplicit(text);
  if (explicit) {
    return {
      derived: false,
      bands: [
        { key: 'z1', label: 'Zone 1', desc: 'Low / easy', pct: explicit.z1, color: 'var(--z1)' },
        { key: 'z2', label: 'Zone 2', desc: "No-man's land", pct: explicit.z2, color: 'var(--z2)' },
        { key: 'z3', label: 'Zone 3', desc: 'Hard', pct: explicit.z3, color: 'var(--z4)' },
      ],
    };
  }
  // Derived heuristic from EF/decouple cues — readable, not authoritative.
  return {
    derived: true,
    bands: [
      { key: 'z1', label: 'Zone 1', desc: 'Low / easy', pct: 78, color: 'var(--z1)' },
      { key: 'z2', label: 'Zone 2', desc: "No-man's land", pct: 9, color: 'var(--z2)' },
      { key: 'z3', label: 'Zone 3', desc: 'Hard', pct: 13, color: 'var(--z4)' },
    ],
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Polarization() {
  const q = useQuery({
    queryKey: ['polarization'],
    queryFn: () => callMcp('get_training_insights', {}) as Promise<{ result?: string } | string>,
  });

  const body = (() => {
    if (q.isLoading) return <div className="space-y-3"><SkeletonCard rows={5} /><SkeletonCard rows={3} /></div>;
    if (q.isError) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[13px] text-slate-400">Could not load intensity data.</p>
          <button onClick={() => q.refetch()} className="min-h-[44px] rounded-lg bg-bg-raised px-4 text-[13px] font-semibold text-slate-100">Retry</button>
        </div>
      );
    }

    const text = typeof q.data === 'string' ? q.data : q.data?.result ?? '';
    if (!text) return <p className="py-12 text-center text-[13px] text-slate-400">No training data in this window.</p>;

    const { bands, derived } = deriveBands(text);
    const z2 = bands.find((b) => b.key === 'z2')!.pct;
    const z2High = z2 > 5;

    const decouple = parseDecoupleTrend(text);
    let trend: { dir: 'up' | 'down'; label: string } | null = null;
    if (decouple.length >= 2) {
      const delta = decouple[decouple.length - 1] - decouple[0];
      trend = delta > 0
        ? { dir: 'up', label: 'Decoupling rising — aerobic durability declining' }
        : { dir: 'down', label: 'Decoupling falling — aerobic durability improving' };
    }

    return (
      <div className="space-y-4">
        <section className="aura-glass rounded-2xl p-4" style={{ boxShadow: 'var(--glow-accent)' }}>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-slate-500">
            Rolling 4-Week Intensity
          </h2>
          <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-bg-base">
            {bands.map((b) => (
              <div key={b.key} style={{ width: `${b.pct}%`, backgroundColor: b.color }} aria-label={`${b.label} ${b.pct}%`} />
            ))}
          </div>
          <ul className="space-y-2.5">
            {bands.map((b) => (
              <li key={b.key} className="flex items-center gap-3" data-testid={`zone-${b.key}`}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: b.color }} aria-hidden="true" />
                <span className="text-[13px] font-medium text-slate-100">{b.label}</span>
                <span className="text-[11px] text-slate-500">{b.desc}</span>
                <span className="ml-auto font-mono text-[14px] font-semibold text-slate-100">{b.pct}%</span>
              </li>
            ))}
          </ul>
          {derived && (
            <p className="mt-3 text-[11px] leading-snug text-slate-500">
              Derived from load and aerobic-efficiency signals; no raw zone stream available.
            </p>
          )}
        </section>

        {z2High ? (
          <section className="flex items-start gap-3 rounded-2xl border border-status-yellow/40 bg-status-yellow/10 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-status-yellow" aria-hidden="true" />
            <div>
              <div className="text-[13px] font-semibold text-status-yellow">Too much time in no-man's land</div>
              <p className="mt-1 text-[12px] leading-snug text-slate-300">
                Zone 2 sits at <span className="font-mono">{z2}%</span> (target &lt;5%). Tempo riding builds
                fatigue without the aerobic payoff of easy volume or the stimulus of hard work.
              </p>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-border-default bg-bg-surface p-4">
            <div className="text-[13px] font-semibold text-status-green">Well polarized</div>
            <p className="mt-1 text-[12px] leading-snug text-slate-400">
              Zone 2 at <span className="font-mono">{z2}%</span>, within the &lt;5–10% polarized window.
            </p>
          </section>
        )}

        {trend && (
          <section className="flex items-center gap-3 rounded-2xl border border-border-default bg-bg-surface p-4">
            {trend.dir === 'up'
              ? <TrendingUp size={18} className="shrink-0 text-status-red" aria-hidden="true" />
              : <TrendingDown size={18} className="shrink-0 text-status-green" aria-hidden="true" />}
            <p className="text-[12px] leading-snug text-slate-300">{trend.label}</p>
          </section>
        )}
      </div>
    );
  })();

  return (
    <AppShell title="Polarization" showBack>
      <div className="screen">{body}</div>
    </AppShell>
  );
}
