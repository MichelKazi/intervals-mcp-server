import { ZONE_COLORS, ZONE_TEXT, ZONE_LABELS, type Zone } from './zoneColors';

export interface ZoneBadgeProps {
  zone?: Zone;
  label?: string;
}

/** Small zone-colored pill. Falls back to a neutral pill when no zone given. */
export default function ZoneBadge({ zone, label }: ZoneBadgeProps) {
  const text = label ?? (zone ? ZONE_LABELS[zone] : '');

  if (!zone) {
    return (
      <span className="inline-flex items-center rounded-full bg-bg-raised px-2 py-0.5 text-[11px] font-medium text-slate-400">
        {text}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: `${ZONE_COLORS[zone]}26`, color: ZONE_TEXT[zone] }}
    >
      {text || `Zone ${zone}`}
    </span>
  );
}
