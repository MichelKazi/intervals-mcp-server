import { useId, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '../../lib/cn';
import tokens from '../../tokens/generated/tokens';
import type { PMCChartProps, PMCDataPoint, PMCPeriod } from './PMCChart.types';

/**
 * @component PMCChart
 * @description Performance Management Chart: CTL (fitness) and ATL (fatigue)
 * trend lines over a TSB (form) area. The TSB fill is green above the zero
 * baseline and red below, split by a gradient at the zero crossing.
 * @spec recharts ComposedChart in a ResponsiveContainer (height 200). CTL =
 * zone1 blue line, ATL = zone3 orange line, TSB = gradient area (status.good →
 * status.danger across zero). `period` trails the last 4/8/12 weeks; 'all' is
 * full. With `interactive`, period toggle pills render above the chart.
 * @accessibility Chart container is role="img" with a descriptive aria-label.
 * Toggle pills are buttons with aria-pressed.
 */

const PERIOD_DAYS: Record<Exclude<PMCPeriod, 'all'>, number> = {
  '4w': 28,
  '8w': 56,
  '12w': 84,
};

const PERIODS: PMCPeriod[] = ['4w', '8w', '12w', 'all'];

/** Trailing slice of data for a period; 'all' returns the input unchanged. */
export function filterByPeriod(data: PMCDataPoint[], period: PMCPeriod): PMCDataPoint[] {
  if (period === 'all') return data;
  return data.slice(-PERIOD_DAYS[period]);
}

/** Fraction [0,1] of the value range that sits above zero, for the gradient split. */
function zeroOffset(data: PMCDataPoint[]): number {
  const max = Math.max(0, ...data.map((d) => d.tsb));
  const min = Math.min(0, ...data.map((d) => d.tsb));
  if (max <= 0) return 0;
  if (min >= 0) return 1;
  return max / (max - min);
}

const AXIS_COLOR = tokens.color.text.muted;

export function PMCChart({
  data,
  period = 'all',
  interactive = false,
  className,
}: PMCChartProps) {
  const id = useId();
  const gradientId = `pmc-tsb-${id}`;
  const [active, setActive] = useState<PMCPeriod>(period);

  if (data.length === 0) {
    return (
      <div
        role="img"
        aria-label="Performance management chart: no data"
        className={cn('flex h-[200px] items-center justify-center text-sm text-text-muted', className)}
      >
        No PMC data
      </div>
    );
  }

  const shown = filterByPeriod(data, interactive ? active : period);
  const offset = zeroOffset(shown);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {interactive && (
        <div className="flex gap-1" role="group" aria-label="Chart period">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={active === p}
              onClick={() => setActive(p)}
              className={cn(
                'rounded-full px-2 py-0.5 font-ui text-xs uppercase',
                active === p
                  ? 'bg-bg-high text-text-primary'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <div
        role="img"
        aria-label="Performance management chart: fitness, fatigue, form over time"
      >
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={shown} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset={offset} stopColor={tokens.color.status.good} stopOpacity={0.35} />
                <stop offset={offset} stopColor={tokens.color.status.danger} stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={tokens.color.border.subtle} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: AXIS_COLOR, fontSize: 10 }} stroke={AXIS_COLOR} />
            <YAxis tick={{ fill: AXIS_COLOR, fontSize: 10 }} stroke={AXIS_COLOR} width={28} />
            <Tooltip
              contentStyle={{
                background: tokens.color.bg.raised,
                border: `1px solid ${tokens.color.border.subtle}`,
                borderRadius: 8,
                color: tokens.color.text.primary,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="tsb"
              stroke="none"
              fill={`url(#${gradientId})`}
              name="Form (TSB)"
            />
            <Line
              type="monotone"
              dataKey="ctl"
              stroke={tokens.color.zone['1']}
              strokeWidth={2}
              dot={false}
              name="Fitness (CTL)"
            />
            <Line
              type="monotone"
              dataKey="atl"
              stroke={tokens.color.zone['3']}
              strokeWidth={2}
              dot={false}
              name="Fatigue (ATL)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
