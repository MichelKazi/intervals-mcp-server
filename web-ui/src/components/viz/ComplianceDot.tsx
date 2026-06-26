import { cn } from '@/lib/utils';

export interface ComplianceDotProps {
  planned?: number | null;
  actual?: number | null;
  className?: string;
}

interface State {
  color: string | null; // null → render a dash (no planned)
  label: string;
}

const STATUS = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
};

function complianceState(
  planned?: number | null,
  actual?: number | null,
): State {
  if (planned == null || planned <= 0) {
    return { color: null, label: 'No planned workout' };
  }
  if (actual == null || actual <= 0) {
    return { color: STATUS.red, label: 'Skipped — planned but not completed' };
  }
  const offBy = Math.abs(actual - planned) / planned;
  if (offBy <= 0.1) return { color: STATUS.green, label: 'Completed within 10% of target' };
  if (offBy <= 0.25) return { color: STATUS.yellow, label: 'Completed 10–25% off target' };
  return { color: STATUS.red, label: 'Completed more than 25% off target' };
}

/**
 * Training compliance indicator. Color + shape, with an aria-label so it is
 * never color-alone. Renders a dash for rest days (no planned load).
 */
export default function ComplianceDot({ planned, actual, className }: ComplianceDotProps) {
  const { color, label } = complianceState(planned, actual);

  if (color == null) {
    return (
      <span
        role="img"
        aria-label={label}
        className={cn('inline-flex h-3 w-3 items-center justify-center text-slate-500', className)}
      >
        —
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-block h-3 w-3 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color }}
    />
  );
}
