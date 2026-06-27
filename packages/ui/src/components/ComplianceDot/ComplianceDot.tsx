import { cn } from '../../lib/cn';
import tokens from '../../tokens/generated/tokens';
import type { ComplianceDotProps } from './ComplianceDot.types';

/**
 * @component ComplianceDot
 * @description Single dot encoding how closely actual load matched the plan.
 * @spec
 * - planned <= 0 → dash "—" (rest day), muted, aria-label "Rest day".
 * - ratio = actual / planned.
 * - ratio >= 0.9 → good (green), "On target".
 * - 0.75 <= ratio < 0.9 → caution (amber), "Slightly under".
 * - ratio < 0.75 → danger (red), "Well under".
 * - Filled circle, size px, rounded-full, inline bg color, role="img".
 * - showLabel renders the label as text-xs text-text-secondary beside the dot.
 * @tokens color.status.good|caution|danger, text-text-muted, text-text-secondary
 * @accessibility
 * - role="img" with descriptive aria-label; color is never the sole signal
 *   (label available via showLabel and aria-label).
 */

const DIAMETER = { sm: 8, md: 12 } as const;

function resolve(planned: number, actual: number): { color: string; label: string } | null {
  if (planned <= 0) return null;
  const ratio = actual / planned;
  if (ratio >= 0.9) return { color: tokens.color.status.good, label: 'On target' };
  if (ratio >= 0.75) return { color: tokens.color.status.caution, label: 'Slightly under' };
  return { color: tokens.color.status.danger, label: 'Well under' };
}

export function ComplianceDot({
  planned,
  actual,
  size = 'sm',
  showLabel = false,
  className,
}: ComplianceDotProps) {
  const result = resolve(planned, actual);

  if (result === null) {
    return (
      <span
        className={cn('inline-flex items-center gap-1.5 text-text-muted', className)}
        role="img"
        aria-label="Rest day"
      >
        <span aria-hidden="true">—</span>
        {showLabel && <span className="text-xs text-text-secondary">Rest day</span>}
      </span>
    );
  }

  const px = DIAMETER[size];

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        className="inline-block rounded-full"
        style={{ width: px, height: px, backgroundColor: result.color }}
        role="img"
        aria-label={result.label}
      />
      {showLabel && <span className="text-xs text-text-secondary">{result.label}</span>}
    </span>
  );
}
