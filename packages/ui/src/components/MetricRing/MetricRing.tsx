import { useEffect, useId, useState } from 'react';
import { cn } from '../../lib/cn';
import tokens from '../../tokens/generated/tokens';
import { ConfoundPill } from '../ConfoundPill';
import { ContributorRow } from '../ContributorRow';
import { Eyebrow } from '../Eyebrow';
import { MetricValue } from '../MetricValue';
import type { MetricRingProps, MetricRingSize, MetricRingStatus } from './MetricRing.types';

/**
 * @component MetricRing
 * @description The readiness centerpiece: a 270° gauge arc with a violet→status
 * gradient fill, glowing brighter as the value rises, a big mono number at its
 * center, and a status word + plain-language meaning below. Optionally tappable
 * to reveal a contributor breakdown.
 * @spec 270° sweep starting at 135°; track arc in border.default, value arc in a
 * useId-keyed gradient (accent.secondary → status color) with a value-scaled
 * drop-shadow glow; center number via MetricValue; clamps value to [0, max].
 * @tokens status.good/caution/danger, text.secondary (neutral), accent.secondary,
 * border.default.
 * @accessibility Arc container is role="meter" with aria-valuenow/min/max and an
 * aria-label; meaning text is linked via aria-describedby; statusWord is real
 * text; when expandable the toggle is a button whose name includes the label.
 */

const START_DEG = 135;
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, a: number, b: number) {
  const s = polar(cx, cy, r, a);
  const e = polar(cx, cy, r, b);
  const large = b - a > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

const STATUS_COLOR: Record<MetricRingStatus, string> = {
  good: tokens.color.status.good,
  caution: tokens.color.status.caution,
  danger: tokens.color.status.danger,
  neutral: tokens.color.text.secondary,
};

const DIMENSIONS: Record<MetricRingSize, { box: number; stroke: number; numberSize: 'xl' | '2xl' | '3xl' }> = {
  sm: { box: 120, stroke: 8, numberSize: 'xl' },
  md: { box: 160, stroke: 9, numberSize: '2xl' },
  lg: { box: 200, stroke: 10, numberSize: '3xl' },
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function MetricRing({
  value,
  max = 100,
  status,
  statusWord,
  meaning,
  label,
  confound,
  contributors,
  size = 'lg',
  animated = true,
  expandable = false,
  className,
}: MetricRingProps) {
  if (meaning === '' || meaning == null) {
    throw new Error('MetricRing: meaning is required');
  }

  const id = useId();
  const gradientId = `metric-ring-grad-${id}`;
  const meaningId = `metric-ring-meaning-${id}`;

  const clamped = Math.max(0, Math.min(max, value));
  const pct = max > 0 ? clamped / max : 0;
  const color = STATUS_COLOR[status];

  const { box, stroke, numberSize } = DIMENSIONS[size];
  const cx = box / 2;
  const cy = box / 2;
  const r = box / 2 - stroke;

  const trackPath = arcPath(cx, cy, r, START_DEG, START_DEG + SWEEP);
  const valuePath = arcPath(cx, cy, r, START_DEG, START_DEG + SWEEP);

  // Arc length of the full sweep; draw-on hides then reveals the value fraction.
  const sweepLen = (2 * Math.PI * r * SWEEP) / 360;
  const valueLen = sweepLen * pct;
  const blur = 4 + 8 * pct;

  const shouldAnimate = animated && !prefersReducedMotion();
  const [drawn, setDrawn] = useState(!shouldAnimate);
  useEffect(() => {
    if (!shouldAnimate) {
      setDrawn(true);
      return;
    }
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, [shouldAnimate]);

  const [open, setOpen] = useState(false);
  const hasContributors = !!contributors?.length;
  const showContributors = hasContributors && (!expandable || open);

  const ring = (
    <div className="flex flex-col items-center gap-3">
      {label && <Eyebrow color="muted">{label}</Eyebrow>}

      <div
        className="relative"
        style={{ width: box, height: box }}
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? statusWord}
        aria-describedby={meaningId}
      >
        <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={tokens.color.accent.secondary} />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
          </defs>
          <path
            d={trackPath}
            fill="none"
            stroke={tokens.color.border.default}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={valuePath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{
              strokeDasharray: `${valueLen} ${sweepLen}`,
              strokeDashoffset: drawn ? 0 : valueLen,
              transition: shouldAnimate ? 'stroke-dashoffset 0.8s ease-out' : undefined,
              filter: `drop-shadow(0 0 ${blur}px ${color}59)`,
            }}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <MetricValue value={Math.round(clamped)} size={numberSize} mono color={color} />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <span
          className="font-bold"
          style={{ color, fontSize: '1.125rem', lineHeight: 1.2 }}
        >
          {statusWord}
        </span>
        {confound && <ConfoundPill type="custom" label={confound} />}
        <p id={meaningId} className="max-w-[28ch] text-text-secondary text-sm">
          {meaning}
        </p>
      </div>
    </div>
  );

  return (
    <div className={cn('inline-flex flex-col items-center gap-4', className)}>
      {expandable && hasContributors ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${label ?? statusWord} details`}
          className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
        >
          {ring}
        </button>
      ) : (
        ring
      )}

      {showContributors && (
        <div className="flex w-full max-w-xs flex-col gap-2">
          {contributors!.map((c, i) => (
            <ContributorRow key={`${c.label}-${i}`} {...c} />
          ))}
        </div>
      )}
    </div>
  );
}
