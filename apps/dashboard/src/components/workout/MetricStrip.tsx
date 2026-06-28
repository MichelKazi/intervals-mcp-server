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
    <div className="flex flex-col items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-4">
      <span className="font-mono text-lg font-semibold leading-none tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-[10px] uppercase leading-none tracking-[0.08em] text-muted-foreground">
        {label}
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
    <div className="mx-4 mb-4 grid grid-cols-4 gap-3">
      {metrics.map((m) => (
        <Metric key={m.label} label={m.label} value={m.value} />
      ))}
    </div>
  );
}
