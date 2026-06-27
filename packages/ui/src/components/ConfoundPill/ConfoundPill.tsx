import { cn } from '../../lib/cn';
import tokens from '../../tokens/generated/tokens';
import type { ConfoundPillProps } from './ConfoundPill.types';

const DEFAULT_LABELS: Record<ConfoundPillProps['type'], string> = {
  dose: '💉 Dose day',
  'poor-sleep': '😴 Poor sleep',
  'high-load': '📈 High load',
  travel: '✈️ Travel',
  custom: '',
};

/**
 * @component ConfoundPill
 * @description Marks a readiness confound — a factor that muddies a verdict.
 * Always amber regardless of type, signaling "interpret with caution".
 * @spec rounded-full, px-3 py-1, font-semibold text-xs; bg amber at 15% alpha,
 * 1px border amber at 35% alpha, text amber. Label defaults per type; an
 * explicit label always overrides (and is required for type 'custom').
 * @accessibility The word in the label carries the meaning; the leading emoji
 * is decorative reinforcement, never the only signal.
 */
export function ConfoundPill({ type, label, className }: ConfoundPillProps) {
  const amber = tokens.color.status.caution;
  const text = label ?? DEFAULT_LABELS[type];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 font-semibold text-xs',
        className,
      )}
      style={{
        backgroundColor: `${amber}26`,
        borderColor: `${amber}59`,
        borderWidth: 1,
        borderStyle: 'solid',
        color: amber,
      }}
    >
      {text}
    </span>
  );
}
