import { cn } from '../../lib/cn';
import { MetricRing } from '../MetricRing';
import type { ReadinessCardProps } from './ReadinessCard.types';

/**
 * @component ReadinessCard
 * @description Home-screen hero card framing a MetricRing. Wraps the readiness
 * gauge in a glass card with generous padding so the centered ring, status
 * word, meaning, confound pill, and contributor bars read as the page's focal
 * point.
 * @spec Glass card (aura-glass aura-edge-light rounded-2xl p-6) containing a
 * centered MetricRing. Defaults label to "READINESS" and contributors to
 * expandable. All MetricRingProps pass through unchanged.
 * @accessibility Inherits MetricRing semantics (role="meter", aria-described
 * meaning, expandable button when contributors present).
 */
export function ReadinessCard({
  label = 'READINESS',
  expandable = true,
  className,
  ...ring
}: ReadinessCardProps) {
  return (
    <div className={cn('aura-glass aura-edge-light rounded-2xl p-6 flex justify-center', className)}>
      <MetricRing {...ring} label={label} expandable={expandable} />
    </div>
  );
}
