import { cn } from '../../lib/cn';
import tokens from '../../tokens/generated/tokens';
import type { EyebrowProps } from './Eyebrow.types';

/**
 * @component Eyebrow
 * @description Small uppercase kicker label above headings.
 * @spec
 * - Renders a <span>: uppercase, tracking 0.15em, text-xs, font-weight 700, font-ui.
 * - accent → tokens.color.accent.primary (inline style).
 * - muted → text-text-muted, ghost → text-text-ghost (Tailwind class).
 * @accessibility
 * - Decorative kicker text; inherits document reading order, no special role.
 */

export function Eyebrow({ children, color = 'muted', className }: EyebrowProps) {
  return (
    <span
      className={cn(
        'font-ui font-bold uppercase text-xs tracking-[0.15em]',
        color === 'muted' && 'text-text-muted',
        color === 'ghost' && 'text-text-ghost',
        className,
      )}
      style={color === 'accent' ? { color: tokens.color.accent.primary } : undefined}
    >
      {children}
    </span>
  );
}
