import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import tokens from '../../tokens/generated/tokens';
import type { ContributorRowProps } from './ContributorRow.types';

/**
 * @component ContributorRow
 * @description One contributor to a composite score: label | gradient bar |
 * value. The bar width encodes the 0–100 score; the value cell shows a
 * pre-formatted displayValue (e.g. "6.4h") or the rounded score.
 * @spec flex items-center gap-3; label fixed w-20 secondary text-sm; bar is a
 * h-1.5 rounded-full track (bg-bg-high) with a color→color gradient fill clamped
 * to [0,100]%; value cell right-aligned mono semibold; optional trend arrow.
 * @tokens status.good (up), status.danger (down), text.muted (flat).
 * @accessibility The bar is role="progressbar" with aria-valuenow/min/max and
 * aria-label from the row label; the trend arrow carries an aria-label.
 */

const TREND = {
  up: { glyph: '↑', label: 'trending up', color: tokens.color.status.good },
  down: { glyph: '↓', label: 'trending down', color: tokens.color.status.danger },
  flat: { glyph: '→', label: 'trending flat', color: tokens.color.text.muted },
} as const;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ContributorRow({
  label,
  value,
  displayValue,
  trend,
  color,
  animated = false,
  className,
}: ContributorRowProps) {
  const pct = Math.max(0, Math.min(100, value));
  const shouldAnimate = animated && !prefersReducedMotion();
  const [fill, setFill] = useState(shouldAnimate ? 0 : pct);

  useEffect(() => {
    if (!shouldAnimate) {
      setFill(pct);
      return;
    }
    // Defer one frame so the transition runs from 0 → pct.
    const raf = requestAnimationFrame(() => setFill(pct));
    return () => cancelAnimationFrame(raf);
  }, [pct, shouldAnimate]);

  const t = trend ? TREND[trend] : undefined;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="w-20 shrink-0 text-text-secondary text-sm">{label}</span>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-high"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${fill}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            transition: shouldAnimate ? 'width 0.8s ease-out' : undefined,
          }}
        />
      </div>
      <span className="flex items-center gap-1 text-right font-mono text-sm font-semibold text-text-primary">
        {displayValue ?? Math.round(value)}
        {t && (
          <span aria-label={t.label} style={{ color: t.color }}>
            {t.glyph}
          </span>
        )}
      </span>
    </div>
  );
}
