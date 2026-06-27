import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';
import { ZONE_COLORS, ZONE_LABELS, type Zone } from '../../lib/zones';
import type { PowerChartProps, PowerInterval } from './PowerChart.types';

/**
 * @component PowerChart
 * @description Workout power profile as gradient zone bars, width ∝ duration,
 *   height ∝ %FTP, with an optional FTP hairline, legend, and tap-to-inspect.
 * @spec
 * - Bars left→right; width flex-grows by durationSecs, height ∝ powerPct/max.
 * - max = max(all powerPct, 1.0); min rendered bar height ~4px.
 * - Color = ZONE_COLORS[zone]; warmup/cooldown forced to zone-1 color @50%.
 * - gradientBars (default true): linear-gradient(180deg, color 0%, color99 100%).
 * - ftpLine (default true): dashed rgba(255,255,255,0.15) hairline at 100% FTP.
 * - interactive: bars focusable (tabIndex 0, role button), Arrow keys move
 *   selection, Enter/click selects and shows a readout below.
 * - summary: text below chart; dev console.warn if a zone>=3 interval has no summary.
 * - showLegend: dot + ZONE_LABELS for the zones present.
 * - Empty intervals → "No workout data".
 * @tokens color.zone.1-5, text-text-muted, text-text-secondary
 * @accessibility
 * - role="group" + session aria-label on the chart.
 * - Each interactive bar: role button, aria-label "{zone}, {pct}% FTP, {duration}".
 * - Color is never the only signal: labels via tap readout and legend.
 */

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function barColor(interval: PowerInterval): string {
  if (interval.isWarmup || interval.isCooldown) return ZONE_COLORS[1];
  return ZONE_COLORS[interval.zone];
}

function barLabel(interval: PowerInterval): string {
  const zone = interval.isWarmup || interval.isCooldown ? 1 : interval.zone;
  const pct = Math.round(interval.powerPct * 100);
  return `${ZONE_LABELS[zone as Zone]}, ${pct}% FTP, ${formatDuration(interval.durationSecs)}`;
}

export function PowerChart({
  intervals,
  ftpLine = true,
  gradientBars = true,
  interactive = false,
  summary,
  height = 90,
  showLegend = false,
  className,
}: PowerChartProps) {
  const [selected, setSelected] = useState<number | null>(null);

  if (process.env.NODE_ENV !== 'production') {
    const hasIntensity = intervals.some((i) => i.zone >= 3 && !i.isWarmup && !i.isCooldown);
    if (hasIntensity && !summary?.trim()) {
      // eslint-disable-next-line no-console
      console.warn(
        'PowerChart: `summary` is required for sessions with a zone>=3 interval but was empty.',
      );
    }
  }

  if (intervals.length === 0) {
    return (
      <div className={cn('text-sm text-text-muted', className)}>No workout data</div>
    );
  }

  const max = Math.max(1, ...intervals.map((i) => i.powerPct));
  const ftpTopPct = (1 - 1 / max) * 100;

  const presentZones = Array.from(
    new Set(intervals.map((i) => (i.isWarmup || i.isCooldown ? 1 : i.zone))),
  ).sort((a, b) => a - b) as Zone[];

  const totalSecs = intervals.reduce((sum, i) => sum + i.durationSecs, 0);
  const groupLabel = `Workout power profile, ${intervals.length} intervals, ${formatDuration(totalSecs)} total`;

  function move(delta: number) {
    setSelected((prev) => {
      const base = prev ?? 0;
      const next = Math.min(intervals.length - 1, Math.max(0, base + delta));
      return next;
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>, idx: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected(idx);
    }
  }

  const sel = selected != null ? intervals[selected] : null;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative flex items-end gap-px" style={{ height }} role="group" aria-label={groupLabel}>
        {ftpLine && (
          <>
            <div
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed"
              style={{ top: `${ftpTopPct}%`, borderColor: 'rgba(255,255,255,0.15)' }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute left-0 text-[10px] uppercase text-text-muted"
              style={{ top: `calc(${ftpTopPct}% - 12px)` }}
              aria-hidden="true"
            >
              FTP
            </span>
          </>
        )}
        {intervals.map((interval, idx) => {
          const color = barColor(interval);
          const heightPct = Math.max((interval.powerPct / max) * 100, 0);
          const dimmed = interval.isWarmup || interval.isCooldown;
          const isSelected = idx === selected;

          const style: CSSProperties = {
            flexGrow: interval.durationSecs,
            flexBasis: 0,
            minWidth: 2,
            height: `${heightPct}%`,
            minHeight: 4,
            opacity: dimmed ? 0.5 : 1,
            background: gradientBars
              ? `linear-gradient(180deg, ${color} 0%, ${color}99 100%)`
              : color,
            outline: isSelected ? `1px solid ${color}` : undefined,
            outlineOffset: 1,
          };

          return (
            <div
              key={idx}
              style={style}
              className="rounded-sm transition-opacity"
              {...(interactive
                ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': barLabel(interval),
                    'aria-pressed': isSelected,
                    onClick: () => setSelected(idx),
                    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => onKeyDown(e, idx),
                  }
                : { 'aria-hidden': true })}
            />
          );
        })}
      </div>

      {interactive && sel && (
        <div className="text-xs text-text-secondary" aria-live="polite">
          {sel.label ? `${sel.label} — ` : ''}
          {ZONE_LABELS[(sel.isWarmup || sel.isCooldown ? 1 : sel.zone) as Zone]},{' '}
          {Math.round(sel.powerPct * 100)}% FTP
        </div>
      )}

      {summary && <p className="text-sm text-text-secondary">{summary}</p>}

      {showLegend && (
        <ul className="flex flex-wrap gap-3" aria-label="Zone legend">
          {presentZones.map((z) => (
            <li key={z} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: ZONE_COLORS[z] }}
                aria-hidden="true"
              />
              {ZONE_LABELS[z]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
