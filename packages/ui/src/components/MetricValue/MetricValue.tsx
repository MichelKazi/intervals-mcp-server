import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import type { MetricValueProps, MetricValueSize } from './MetricValue.types';

/**
 * @component MetricValue
 * @description Renders a numeric metric with an optional trailing unit. Always
 * tabular-nums so digits don't jitter. Optional count-up animation on mount.
 * @spec size maps to fontSize tokens (sm→3xl); 2xl/3xl are bold; unit renders
 * one step smaller in secondary color; custom color applies inline to the
 * number only.
 * @accessibility The rendered text conveys value + unit directly; no extra ARIA.
 */

const SIZE_CLASS: Record<MetricValueSize, string> = {
  sm: 'text-sm',
  md: 'text-md',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl font-bold',
  '3xl': 'text-3xl font-bold',
};

const UNIT_SIZE: Record<MetricValueSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
  xl: 'text-base',
  '2xl': 'text-lg',
  '3xl': 'text-xl',
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Count up from 0 to `target` over ~600ms ease-out, matching its decimals. */
function useCountUp(target: number, enabled: boolean) {
  const decimals = (String(target).split('.')[1] ?? '').length;
  const [display, setDisplay] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const duration = 600;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);

  return Number(display.toFixed(decimals));
}

export function MetricValue({
  value,
  unit,
  size = 'md',
  color,
  animated = false,
  mono = true,
  className,
}: MetricValueProps) {
  const isNumber = typeof value === 'number';
  const shouldAnimate = animated && isNumber && !prefersReducedMotion();
  const counted = useCountUp(isNumber ? value : 0, shouldAnimate);
  const shown = isNumber ? (shouldAnimate ? counted : value) : value;

  return (
    <span
      className={cn(
        'inline-flex items-baseline tabular-nums',
        mono ? 'font-mono' : 'font-ui',
        SIZE_CLASS[size],
        'text-text-primary',
        className,
      )}
    >
      <span style={color ? { color } : undefined}>{shown}</span>
      {unit && (
        <span className={cn('ml-1 text-text-secondary', UNIT_SIZE[size])}>
          {unit}
        </span>
      )}
    </span>
  );
}
