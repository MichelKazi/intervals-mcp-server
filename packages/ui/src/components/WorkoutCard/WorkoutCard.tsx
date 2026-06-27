import { cn } from '../../lib/cn';
import { AdaptiveBadge } from '../AdaptiveBadge';
import { Eyebrow } from '../Eyebrow';
import { PowerChart } from '../PowerChart';
import type { WorkoutCardProps, WorkoutStatus } from './WorkoutCard.types';

/**
 * @component WorkoutCard
 * @description Glass card summarizing one workout: name, date, type, duration,
 * TSS, optional difficulty badge, and an optional embedded power profile.
 * @spec Eyebrow kicker derives from status (planned/completed/unlogged); a
 * missing status reads as planned. Title is the workout name. Meta line shows
 * date, type, and humanized duration. TSS renders as a neutral mono pill;
 * intensityFactor adds an AdaptiveBadge. Non-empty intervals embed a PowerChart
 * (which renders its own summary). Never renders the word "MISSED".
 * @accessibility With onClick the card is a full-width left-aligned button whose
 * accessible name includes the workout name and status word; otherwise an
 * article.
 */

const STATUS_LABEL: Record<WorkoutStatus, string> = {
  planned: 'NEXT WORKOUT',
  completed: 'COMPLETED',
  unlogged: 'UNLOGGED',
};

/** Seconds → "1h 58m" or "45m". */
function formatDuration(secs: number): string {
  const total = Math.round(secs / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function WorkoutCard({
  name,
  date,
  type,
  durationSecs,
  tss,
  intensityFactor,
  intervals,
  summary,
  status = 'planned',
  onClick,
  className,
}: WorkoutCardProps) {
  const eyebrow = STATUS_LABEL[status] ?? STATUS_LABEL.planned;
  const hasChart = Array.isArray(intervals) && intervals.length > 0;

  const body = (
    <>
      <Eyebrow color="accent">{eyebrow}</Eyebrow>
      <h3 className="font-display text-xl font-bold text-text-primary">{name}</h3>
      <p className="text-sm text-text-muted">
        {date} · {type} · {formatDuration(durationSecs)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border-default bg-bg-raised px-3 py-1 font-mono text-xs text-text-secondary">
          {tss} TSS
        </span>
        {intensityFactor !== undefined && (
          <AdaptiveBadge intensityFactor={intensityFactor} />
        )}
      </div>
      {hasChart && (
        // ponytail: chart bars aren't interactive when the whole card is a
        // button — nested interactive controls fail a11y.
        <PowerChart
          intervals={intervals}
          summary={summary}
          ftpLine
          interactive={!onClick}
          height={90}
        />
      )}
    </>
  );

  const rootClass = cn(
    'aura-glass aura-edge-light rounded-2xl p-5 flex flex-col gap-2',
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${name}, ${STATUS_LABEL[status] ?? STATUS_LABEL.planned}`}
        className={cn(
          rootClass,
          'w-full text-left transition active:scale-[0.99]',
        )}
      >
        {body}
      </button>
    );
  }

  return <article className={rootClass}>{body}</article>;
}
