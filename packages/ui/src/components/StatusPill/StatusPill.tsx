import { cn } from '../../lib/cn';
import tokens from '../../tokens/generated/tokens';
import type { StatusPillProps } from './StatusPill.types';

/**
 * @component StatusPill
 * @description Compact status label. Color, border, and tint derive from a
 * semantic status; 'neutral' falls back to design-system surface tokens.
 * @spec rounded-full, font-semibold text-xs; bg = status color at 12% alpha,
 * 1px border at 25% alpha, text = status color; neutral uses bg-raised,
 * border-default, text-secondary. sm px-2 py-0.5, md px-3 py-1; icon gap-1.
 * @accessibility Label text conveys status independently of color; the icon
 * is supplementary, never the sole signal.
 */
export function StatusPill({
  status,
  label,
  icon,
  size = 'sm',
  className,
}: StatusPillProps) {
  const base = cn(
    'inline-flex items-center gap-1 rounded-full border font-semibold text-xs',
    size === 'md' ? 'px-3 py-1' : 'px-2 py-0.5',
    className,
  );

  if (status === 'neutral') {
    return (
      <span className={cn(base, 'bg-bg-raised border-border-default text-text-secondary')}>
        {icon != null && <span aria-hidden="true">{icon}</span>}
        {label}
      </span>
    );
  }

  const color = tokens.color.status[status];
  return (
    <span
      className={base}
      style={{ backgroundColor: `${color}1f`, borderColor: `${color}40`, color }}
    >
      {icon != null && <span aria-hidden="true">{icon}</span>}
      {label}
    </span>
  );
}
