import { cn } from '../../lib/cn';
import { ZONE_COLORS, ZONE_LABELS, type Zone } from '../../lib/zones';
import tokens from '../../tokens/generated/tokens';
import type { ZoneBadgeColor, ZoneBadgeProps } from './ZoneBadge.types';

/**
 * @component ZoneBadge
 * @description Pill label tinted by training zone or status color.
 * @spec
 * - Always rounded-full, font-weight 700, uppercase, text-xs.
 * - Color from `color` if given, else derived from `zone`.
 * - subtle: bg color@15%, border color@35%, text color.
 * - outline: transparent bg, border color@35%, text color.
 * - solid: bg color, text #07080f.
 * - Label = label ?? ZONE_LABELS[zone] ?? ''.
 * @accessibility
 * - Plain text content; readable label, no interactive role.
 */

const SOLID_TEXT = '#07080f';

function resolveHex(color?: ZoneBadgeColor, zone?: Zone): string {
  const key = color ?? (zone != null ? (`zone${zone}` as ZoneBadgeColor) : undefined);
  switch (key) {
    case 'zone1':
      return ZONE_COLORS[1];
    case 'zone2':
      return ZONE_COLORS[2];
    case 'zone3':
      return ZONE_COLORS[3];
    case 'zone4':
      return ZONE_COLORS[4];
    case 'zone5':
      return ZONE_COLORS[5];
    case 'good':
      return tokens.color.status.good;
    case 'caution':
      return tokens.color.status.caution;
    case 'danger':
      return tokens.color.status.danger;
    case 'accent':
      return tokens.color.accent.primary;
    default:
      return tokens.color.accent.primary;
  }
}

export function ZoneBadge({
  zone,
  label,
  color,
  size = 'sm',
  variant = 'subtle',
  className,
}: ZoneBadgeProps) {
  const hex = resolveHex(color, zone);
  const text = label ?? (zone != null ? ZONE_LABELS[zone] : '');

  const style =
    variant === 'solid'
      ? { backgroundColor: hex, color: SOLID_TEXT }
      : variant === 'outline'
        ? { backgroundColor: 'transparent', border: `1px solid ${hex}59`, color: hex }
        : { backgroundColor: `${hex}26`, border: `1px solid ${hex}59`, color: hex };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-ui font-bold uppercase text-xs',
        size === 'md' ? 'px-3 py-1' : 'px-2 py-0.5',
        className,
      )}
      style={style}
    >
      {text}
    </span>
  );
}
