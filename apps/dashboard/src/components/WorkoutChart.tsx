import { useState, useCallback, useRef } from 'react';
import type { WorkoutStep, IntervalLap } from '../lib/types';
import { zoneColor, zoneName, formatDuration, formatWatts } from '../lib/format';

interface WorkoutChartProps {
  steps?: WorkoutStep[];
  laps?: IntervalLap[];
  ftp?: number;
}

interface FlatBar {
  pctFtp: number;
  durationSecs: number;
  watts?: number;
  label?: string;
}

function flattenSteps(steps: WorkoutStep[], ftp?: number): FlatBar[] {
  const bars: FlatBar[] = [];
  for (const step of steps) {
    if (step.reps && step.steps) {
      for (let i = 0; i < step.reps; i++) {
        bars.push(...flattenSteps(step.steps, ftp));
      }
    } else {
      const pct = step.power?.value ?? 0;
      const watts = ftp ? pct * ftp / 100 : undefined;
      bars.push({ pctFtp: pct, durationSecs: step.duration ?? 0, watts, label: step.text });
    }
  }
  return bars;
}

function lapsToFlatBars(laps: IntervalLap[], ftp?: number): FlatBar[] {
  return laps.map(lap => {
    const watts = lap.average_watts;
    const pctFtp = watts && ftp ? (watts / ftp) * 100 : 0;
    return {
      pctFtp,
      durationSecs: lap.moving_time ?? lap.elapsed_time ?? 0,
      watts,
      label: lap.label,
    };
  });
}

export default function WorkoutChart({ steps, laps, ftp }: WorkoutChartProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  const bars: FlatBar[] = steps ? flattenSteps(steps, ftp) : laps ? lapsToFlatBars(laps, ftp) : [];
  const maxPct = Math.max(...bars.map(b => b.pctFtp), 100);
  const CHART_HEIGHT = 200;
  const MIN_BAR_HEIGHT = 4;

  const handleKey = useCallback((e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const newIdx = Math.min(idx + 1, bars.length - 1);
      setSelectedIdx(newIdx);
      barRefs.current[newIdx]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const newIdx = Math.max(idx - 1, 0);
      setSelectedIdx(newIdx);
      barRefs.current[newIdx]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedIdx(idx);
    }
  }, [bars.length]);

  const selected = selectedIdx !== null ? bars[selectedIdx] : null;

  if (bars.length === 0) {
    return <div style={{ color: 'var(--text-dim)', padding: 'var(--sp-4)' }}>No workout data</div>;
  }

  // Steady workout: effectively one zone — ≤2 distinct 5% buckets AND a narrow
  // intensity spread (≤15% FTP), so warmup+work interval sets stay on the bar
  // chart. A flat full-bleed slab reads as broken, so render an intentional
  // single-bar summary with an FTP hairline + label instead.
  const minPct = Math.min(...bars.map((b) => b.pctFtp));
  const maxBarPct = Math.max(...bars.map((b) => b.pctFtp));
  const distinct = new Set(bars.map((b) => Math.round(b.pctFtp / 5))).size;
  const isSteady = distinct <= 2 && maxBarPct - minPct <= 15;
  if (isSteady) {
    const totalSecs = bars.reduce((s, b) => s + b.durationSecs, 0);
    const dominant = [...bars].sort((a, b) => b.durationSecs - a.durationSecs)[0];
    const pct = dominant.pctFtp;
    const barH = Math.max(MIN_BAR_HEIGHT, Math.min(0.85, pct / maxPct) * (CHART_HEIGHT - 16));
    const ftpY = (CHART_HEIGHT - 16) * (1 - Math.min(1, 100 / maxPct));
    return (
      <div style={{ width: '100%' }} data-testid="workout-steady">
        <div
          role="group"
          aria-label={`Steady workout: ${zoneName(pct)}, ${pct.toFixed(0)}% FTP, ${formatDuration(totalSecs)}`}
          style={{
            position: 'relative',
            height: CHART_HEIGHT,
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            padding: 'var(--sp-2)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          {/* FTP reference hairline */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 'var(--sp-2)',
              right: 'var(--sp-2)',
              top: ftpY + 8,
              borderTop: '1px dashed var(--border)',
              fontSize: 0,
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: 'var(--sp-3)',
              top: ftpY + 12,
              fontSize: 10,
              letterSpacing: '0.05em',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
            }}
          >
            FTP
          </span>
          <div
            style={{
              width: '100%',
              height: barH,
              background: `linear-gradient(180deg, ${zoneColor(pct)} 0%, ${zoneColor(pct)}cc 100%)`,
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            }}
          />
        </div>
        <div
          data-testid="workout-readout"
          style={{
            marginTop: 'var(--sp-2)',
            padding: 'var(--sp-3)',
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-2)',
            fontSize: 13,
            color: 'var(--text)',
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 10, height: 10, borderRadius: 2, background: zoneColor(pct), flexShrink: 0 }}
          />
          <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{zoneName(pct)}</span>
          <span style={{ color: 'var(--text-dim)' }}>·</span>
          <span className="font-mono">{pct.toFixed(0)}% FTP</span>
          {dominant.watts ? (
            <>
              <span style={{ color: 'var(--text-dim)' }}>·</span>
              <span className="font-mono">{formatWatts(dominant.watts)}</span>
            </>
          ) : null}
          <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }} className="font-mono">
            {formatDuration(totalSecs)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: CHART_HEIGHT,
          gap: 1,
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          padding: 'var(--sp-2)',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
        role="group"
        aria-label="Workout intensity chart"
      >
        {bars.map((bar, idx) => {
          const barH = Math.max(MIN_BAR_HEIGHT, (bar.pctFtp / maxPct) * (CHART_HEIGHT - 16));
          const isSelected = selectedIdx === idx;
          return (
            <div
              key={idx}
              ref={el => { barRefs.current[idx] = el; }}
              data-testid="workout-bar"
              role="button"
              tabIndex={idx === (selectedIdx ?? 0) ? 0 : -1}
              aria-label={`${bar.pctFtp.toFixed(0)}% FTP, ${formatDuration(bar.durationSecs)}, ${zoneName(bar.pctFtp)}`}
              aria-pressed={isSelected}
              onClick={() => setSelectedIdx(idx)}
              onKeyDown={(e) => handleKey(e, idx)}
              style={{
                position: 'relative',
                minWidth: 44,
                flex: `${bar.durationSecs} 0 0`,
                height: CHART_HEIGHT - 16,
                display: 'flex',
                alignItems: 'flex-end',
                cursor: 'pointer',
                outline: isSelected ? '2px solid var(--brand)' : 'none',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: barH,
                  background: `linear-gradient(180deg, ${zoneColor(bar.pctFtp)} 0%, ${zoneColor(bar.pctFtp)}b3 100%)`,
                  borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                  opacity: isSelected ? 1 : 0.85,
                }}
              />
            </div>
          );
        })}
      </div>
      {selected !== null ? (
        <div
          data-testid="workout-readout"
          style={{
            marginTop: 'var(--sp-2)',
            padding: 'var(--sp-3)',
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--sp-2)',
            fontSize: 13,
          }}
        >
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zone</div>
            <div style={{ color: 'var(--text)' }}>{zoneName(selected.pctFtp)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Intensity</div>
            <div style={{ color: 'var(--text)' }}>
              {selected.watts ? formatWatts(selected.watts) : `${selected.pctFtp.toFixed(0)}%`}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div>
            <div style={{ color: 'var(--text)' }}>{formatDuration(selected.durationSecs)}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>%FTP</div>
            <div style={{ color: 'var(--text)' }}>{selected.pctFtp.toFixed(0)}%</div>
          </div>
        </div>
      ) : (
        <div style={{ height: 'var(--sp-2)' }} />
      )}
    </div>
  );
}
