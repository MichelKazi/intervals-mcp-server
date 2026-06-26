import type { PlannedEvent } from '../../lib/types';
import { formatDuration, kmFromMeters } from '../../lib/format';

interface MetricStripProps {
  event: PlannedEvent;
}

interface MetricProps {
  label: string;
  value: string;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 15, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

/** Compact row of workout metrics — intentionally dimmer/smaller than the chart. */
export default function MetricStrip({ event }: MetricStripProps) {
  const metrics: MetricProps[] = [];

  if (event.moving_time) {
    metrics.push({ label: 'Duration', value: formatDuration(event.moving_time) });
  }
  if (event.icu_training_load != null) {
    metrics.push({ label: 'Load', value: String(Math.round(event.icu_training_load)) });
  }
  if (event.icu_intensity != null) {
    metrics.push({ label: 'IF', value: (event.icu_intensity / 100).toFixed(2) });
  }
  if (event.distance != null && event.distance > 0) {
    metrics.push({ label: 'Dist', value: `${kmFromMeters(event.distance)}km` });
  }

  if (metrics.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-around',
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        margin: '0 var(--sp-4) var(--sp-4)',
        gap: 'var(--sp-4)',
      }}
    >
      {metrics.map((m) => (
        <Metric key={m.label} label={m.label} value={m.value} />
      ))}
    </div>
  );
}
