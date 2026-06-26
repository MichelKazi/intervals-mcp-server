import { Progress } from '@/components/ui/progress';

export interface ContributorRowProps {
  label: string;
  score: number;
  max?: number;
  color?: string;
}

/** A labeled progress bar + numeric score. Used for readiness breakdown. */
export default function ContributorRow({
  label,
  score,
  max = 100,
  color = '#f97316',
}: ContributorRowProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (score / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-[13px] text-slate-400">{label}</span>
      <Progress value={pct} className="flex-1" indicatorStyle={{ backgroundColor: color }} />
      <span className="w-8 shrink-0 text-right font-mono text-sm font-semibold text-slate-100">
        {Math.round(score)}
      </span>
    </div>
  );
}
