/**
 * FitnessTrend — lightweight hand-rolled SVG area/line chart showing
 * CTL (Fitness) and ATL (Fatigue) over the last ~42 days.
 *
 * Two lines + a legend that uses both color AND text labels.
 * Handles empty / single-point series gracefully.
 */

import type { WellnessDay } from '../../lib/types';

interface FitnessTrendProps {
  series: WellnessDay[];
}

const W = 320;
const H = 90;
const PAD = { top: 8, right: 8, bottom: 20, left: 28 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

export default function FitnessTrend({ series }: FitnessTrendProps) {
  // Filter to days that have at least ctl or atl
  const valid = series.filter(d => d.ctl != null || d.atl != null);

  if (valid.length < 2) {
    return null;
  }

  const ctlValues = valid.map(d => d.ctl ?? 0);
  const atlValues = valid.map(d => d.atl ?? 0);
  const allValues = [...ctlValues, ...atlValues].filter(v => v > 0);
  const yMin = Math.max(0, Math.min(...allValues) * 0.85);
  const yMax = Math.max(...allValues) * 1.1;

  const n = valid.length;
  const xScale = (i: number) => PAD.left + (i / (n - 1)) * INNER_W;
  const yScale = (v: number) => PAD.top + INNER_H - ((v - yMin) / (yMax - yMin)) * INNER_H;

  const ctlPoints = ctlValues.map((v, i) => ({ x: xScale(i), y: yScale(v) }));
  const atlPoints = atlValues.map((v, i) => ({ x: xScale(i), y: yScale(v) }));

  // Y-axis ticks — 3 ticks
  const yTicks = [yMin, (yMin + yMax) / 2, yMax].map(v => ({
    y: yScale(v),
    label: Math.round(v),
  }));

  // X-axis: first and last date label
  const firstDate = valid[0].id;
  const lastDate = valid[valid.length - 1].id;
  function shortDate(iso: string) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div aria-label="Fitness and fatigue trend chart" role="figure">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Grid lines */}
        {yTicks.map(t => (
          <line
            key={t.label}
            x1={PAD.left}
            x2={PAD.left + INNER_W}
            y1={t.y}
            y2={t.y}
            stroke="var(--border)"
            strokeWidth="0.5"
            strokeDasharray="3 3"
          />
        ))}

        {/* Y-axis tick labels */}
        {yTicks.map(t => (
          <text
            key={t.label}
            x={PAD.left - 4}
            y={t.y}
            textAnchor="end"
            dominantBaseline="middle"
            fill="var(--text-dim)"
            fontSize="9"
            fontFamily="var(--font)"
          >
            {t.label}
          </text>
        ))}

        {/* X-axis labels */}
        <text
          x={PAD.left}
          y={H - 4}
          textAnchor="start"
          fill="var(--text-dim)"
          fontSize="9"
          fontFamily="var(--font)"
        >
          {shortDate(firstDate)}
        </text>
        <text
          x={PAD.left + INNER_W}
          y={H - 4}
          textAnchor="end"
          fill="var(--text-dim)"
          fontSize="9"
          fontFamily="var(--font)"
        >
          {shortDate(lastDate)}
        </text>

        {/* ATL line (Fatigue) */}
        <path
          d={buildPath(atlPoints)}
          fill="none"
          stroke="var(--z5)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* CTL line (Fitness) — on top */}
        <path
          d={buildPath(ctlPoints)}
          fill="none"
          stroke="var(--z1)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {/* Legend — color + text label so color is not sole indicator */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-4)',
          paddingLeft: PAD.left,
          marginTop: 'var(--sp-1)',
        }}
      >
        <LegendItem color="var(--z1)" label="Fitness (CTL)" />
        <LegendItem color="var(--z5)" label="Fatigue (ATL)" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>
      <svg width="20" height="3" aria-hidden="true">
        <line x1="0" y1="1.5" x2="20" y2="1.5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font)' }}>
        {label}
      </span>
    </div>
  );
}
