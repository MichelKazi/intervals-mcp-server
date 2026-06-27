import { cn } from '@/lib/utils';

export interface MetricRingProps {
  value: number;
  max: number;
  color: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_PX: Record<NonNullable<MetricRingProps['size']>, number> = {
  sm: 64,
  md: 96,
  lg: 128,
};

const VALUE_TEXT: Record<NonNullable<MetricRingProps['size']>, string> = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-3xl',
};

// 270° sweep arc gauge — opens at the bottom.
const SWEEP_DEG = 270;
const START_DEG = 135; // bottom-left start so the gap sits at the bottom

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/**
 * Arc gauge with a 270° sweep. Value number is centered (font-mono) with the
 * label rendered below. Used for the readiness gauge and sleep score.
 */
export default function MetricRing({
  value,
  max,
  color,
  label,
  size = 'md',
  className,
}: MetricRingProps) {
  const px = SIZE_PX[size];
  const stroke = size === 'sm' ? 6 : 8;
  const r = px / 2 - stroke / 2;
  const cx = px / 2;
  const cy = px / 2;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const endDeg = START_DEG + SWEEP_DEG * pct;

  return (
    <div className={cn('inline-flex flex-col items-center gap-1.5', className)}>
      <div className="relative" style={{ width: px, height: px }}>
        <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} aria-hidden="true">
          <path
            d={arcPath(cx, cy, r, START_DEG, START_DEG + SWEEP_DEG)}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {pct > 0 && (
            <path
              d={arcPath(cx, cy, r, START_DEG, endDeg)}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-mono font-semibold text-slate-100', VALUE_TEXT[size])}>
            {Math.round(value)}
          </span>
        </div>
      </div>
      <span className="text-[11px] uppercase tracking-widest font-medium text-slate-500">
        {label}
      </span>
    </div>
  );
}
