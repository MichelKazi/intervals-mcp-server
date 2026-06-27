import { cn } from '../../lib/cn';
import tokens from '../../tokens/generated/tokens';
import type { AdaptiveBadgeProps } from './AdaptiveBadge.types';

/**
 * @component AdaptiveBadge
 * @description Pill that auto-derives a difficulty label and color from a
 * workout intensity factor (IF). Surfaces how hard a session is at a glance.
 * @spec Recovery (IF < 0.75, zone-1 blue); Achievable (0.75–0.85, good green);
 * Productive (0.85–0.95, zone-1 blue); Stretch (0.95–1.0, caution amber);
 * Breakthrough (> 1.0, danger red). Background is the color at 15% alpha.
 * @accessibility Label text carries the meaning; color is reinforcement only.
 * Optional title attribute gives a fuller explanation on hover.
 */
export function AdaptiveBadge({
  intensityFactor,
  size = 'sm',
  showTooltip = false,
  className,
}: AdaptiveBadgeProps) {
  const { label, color, tooltip } = deriveAdaptive(intensityFactor);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold text-xs',
        size === 'md' ? 'px-3 py-1' : 'px-2 py-0.5',
        className,
      )}
      style={{ backgroundColor: `${color}26`, color }}
      title={showTooltip ? tooltip : undefined}
    >
      {label}
    </span>
  );
}

function deriveAdaptive(intensityFactor: number): {
  label: string;
  color: string;
  tooltip: string;
} {
  const { zone, status } = tokens.color;
  if (intensityFactor < 0.75) {
    return {
      label: 'Recovery',
      color: zone['1'],
      tooltip: 'Recovery: very easy — promotes blood flow and adaptation.',
    };
  }
  if (intensityFactor < 0.85) {
    return {
      label: 'Achievable',
      color: status.good,
      tooltip: 'Achievable: comfortable aerobic effort, well within capacity.',
    };
  }
  if (intensityFactor < 0.95) {
    return {
      label: 'Productive',
      color: zone['1'],
      tooltip: 'Productive: solid training stimulus without excessive strain.',
    };
  }
  if (intensityFactor <= 1.0) {
    return {
      label: 'Stretch',
      color: status.caution,
      tooltip: 'Stretch: at or near threshold — productive but demanding.',
    };
  }
  return {
    label: 'Breakthrough',
    color: status.danger,
    tooltip: 'Breakthrough: above threshold — maximal, high-risk effort.',
  };
}
