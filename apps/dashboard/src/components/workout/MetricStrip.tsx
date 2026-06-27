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
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <span className="text-[15px] tabular-nums text-muted-foreground">
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
    <div className="mx-4 mb-4 flex justify-around gap-4 rounded-md bg-card px-4 py-3">
      {metrics.map((m) => (
        <Metric key={m.label} label={m.label} value={m.value} />
      ))}
    </div>
  );
}
