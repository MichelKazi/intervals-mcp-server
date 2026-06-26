import { SkeletonCard } from '@/components/viz';
import { Button } from '@/components/ui/button';

/** Loading skeleton stack shared across More detail screens. */
export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={`Loading ${label}`} className="flex flex-col gap-4 p-4 pb-20">
      <SkeletonCard rows={3} className="rounded-2xl" />
      <SkeletonCard rows={4} className="rounded-2xl" />
    </div>
  );
}

/** Plain error block with a retry action. */
export function DetailError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="m-4 rounded-lg border border-border-default bg-bg-surface p-6 text-center">
      <p className="mb-4 text-slate-400">
        {error instanceof Error ? error.message : 'Could not load this screen. Check your connection.'}
      </p>
      <Button onClick={onRetry} size="touch" className="min-w-[80px]">Retry</Button>
    </div>
  );
}

/** Centered empty-state copy. */
export function DetailEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 pb-20 pt-24 text-center">
      <p className="m-0 text-[15px] font-medium text-slate-100">{title}</p>
      <p className="m-0 text-[13px] text-slate-400">{body}</p>
    </div>
  );
}

/** Section heading matching the dashboard accent eyebrow. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-accent">
      {children}
    </p>
  );
}

/** Status band colors for readiness/score values. */
export function readinessColor(score: number): string {
  if (score >= 67) return '#22c55e';
  if (score >= 34) return '#f59e0b';
  return '#ef4444';
}

export function readinessLabel(score: number): string {
  if (score >= 67) return 'Ready';
  if (score >= 34) return 'Caution';
  return 'Strained';
}

const SHORT_DATE = { month: 'short', day: 'numeric' } as const;

/** "Jun 26" from a YYYY-MM-DD id. */
export function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', SHORT_DATE);
}

/** today and today-Nd as YYYY-MM-DD strings. */
export function dateRange(days: number): { oldest: string; newest: string } {
  const today = new Date();
  const newest = today.toISOString().slice(0, 10);
  const past = new Date(today);
  past.setDate(past.getDate() - days);
  return { oldest: past.toISOString().slice(0, 10), newest };
}
