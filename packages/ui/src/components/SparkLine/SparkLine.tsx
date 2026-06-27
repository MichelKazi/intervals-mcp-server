import { useId } from 'react';
import { cn } from '../../lib/cn';
import tokens from '../../tokens/generated/tokens';
import type { SparkLineProps } from './SparkLine.types';

/**
 * @component SparkLine
 * @description Compact, axis-free trend glyph. Stroke-only by default, with
 * optional gradient area fill, horizontal reference line, and a left-to-right
 * draw-on animation. Renders crisp at any DPI via SVG.
 * @spec stroke 1.5px, round caps/joins; geometry pads 1.5px vertically; empty
 * data renders a blank svg; a single point renders a flat centered line.
 * @accessibility Decorative (aria-hidden); the underlying number is surfaced
 * by sibling text, so the glyph carries no semantic value.
 */
export function SparkLine({
  data,
  color = tokens.color.accent.primary,
  width = 64,
  height = 24,
  animated = false,
  showArea = false,
  referenceValue,
  className,
}: SparkLineProps) {
  const id = useId();
  const gradientId = `sparkline-area-${id}`;

  if (data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        aria-hidden="true"
      />
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 1.5;
  const usableH = height - pad * 2;
  const step = data.length > 1 ? width / (data.length - 1) : 0;

  const y = (d: number) => pad + usableH * (1 - (d - min) / range);
  // Single point: a flat line spanning the full width at its value.
  const coords =
    data.length === 1
      ? [
          { x: 0, y: y(data[0]) },
          { x: width, y: y(data[0]) },
        ]
      : data.map((d, i) => ({ x: i * step, y: y(d) }));

  const linePath = coords
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L${width.toFixed(2)} ${(height - pad).toFixed(
    2,
  )} L0 ${(height - pad).toFixed(2)} Z`;

  // Path length is bounded by the bounding box perimeter; a generous constant
  // dash covers it so the whole stroke hides then reveals.
  const dash = (width + height) * 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn(className)}
      aria-hidden="true"
    >
      {showArea && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        </>
      )}

      {referenceValue !== undefined && (
        <line
          x1={0}
          x2={width}
          y1={y(referenceValue)}
          y2={y(referenceValue)}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="2 2"
          strokeOpacity={0.4}
        />
      )}

      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          animated
            ? {
                strokeDasharray: dash,
                strokeDashoffset: dash,
                animation: 'aura-sparkline-draw 0.8s ease-out forwards',
              }
            : undefined
        }
      />
    </svg>
  );
}
