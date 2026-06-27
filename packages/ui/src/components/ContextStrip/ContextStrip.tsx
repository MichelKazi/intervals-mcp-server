import { cn } from '../../lib/cn';
import { StatusPill } from '../StatusPill';
import type { ContextStripProps } from './ContextStrip.types';

/**
 * @component ContextStrip
 * @description Inline single-row summary of today's plan: planned load, current
 * form, and a timing verdict. A subtle strip, not a card — it sits under the
 * readiness hero without competing with it.
 * @spec bg-bg-surface/50 rounded-xl px-4 py-3 (no glass). Two mono data points
 * ("Today {plannedTSS} TSS", "Form {form} {formLabel}") separated by a ghost
 * "·", then a trailing StatusPill mapping timingStatus → status (good→good,
 * ok→caution, risky→danger). Numbers use font-mono tabular-nums.
 * @accessibility StatusPill label carries the timing meaning; color is
 * reinforcement only.
 */

const TIMING_STATUS = {
  good: 'good',
  ok: 'caution',
  risky: 'danger',
} as const;

export function ContextStrip({
  plannedTSS,
  form,
  formLabel,
  timingStatus,
  timingLabel,
  className,
}: ContextStripProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl bg-bg-surface/50 px-4 py-3 text-sm text-text-secondary',
        className,
      )}
    >
      <span>
        Today <span className="font-mono tabular-nums text-text-primary">{plannedTSS}</span> TSS
      </span>
      <span className="text-text-ghost">·</span>
      <span>
        Form <span className="font-mono tabular-nums text-text-primary">{form}</span> {formLabel}
      </span>
      <StatusPill status={TIMING_STATUS[timingStatus]} label={timingLabel} className="ml-auto" />
    </div>
  );
}
