import { cn } from '../../lib/cn';
import { ZONE_COLORS, ZONE_LABELS, type Zone } from '../../lib/zones';
import type { LibraryTemplateProps } from './LibraryTemplate.types';

/**
 * @component LibraryTemplate
 * @description Workout-library screen layout: search, zone filter chips, item list.
 * @spec
 * - Root: aura-mesh-bg min-h-screen, content max-w-md mx-auto, p-4, pb-20.
 * - search slot at top.
 * - One chip per filterZones (default [1..5]). Active chip (in activeZones) is filled in its
 *   zone color; inactive is outline/subtle. Click fires onToggleZone(zone). aria-pressed reflects active.
 * - items list below.
 * @accessibility
 * - Chips are buttons with aria-pressed and the zone name as accessible label.
 */

const SOLID_TEXT = '#07080f';
const ALL_ZONES: Zone[] = [1, 2, 3, 4, 5];

export function LibraryTemplate({
  search,
  filterZones = ALL_ZONES,
  activeZones = [],
  onToggleZone,
  items,
  className,
}: LibraryTemplateProps) {
  return (
    <div className={cn('aura-mesh-bg min-h-screen', className)}>
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-20">
        {search}
        <div className="flex flex-wrap gap-2">
          {filterZones.map((zone) => {
            const active = activeZones.includes(zone);
            const hex = ZONE_COLORS[zone];
            return (
              <button
                key={zone}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleZone?.(zone)}
                className="inline-flex items-center rounded-full px-3 py-1 font-ui text-xs font-bold uppercase"
                style={
                  active
                    ? { backgroundColor: hex, color: SOLID_TEXT }
                    : { backgroundColor: 'transparent', border: `1px solid ${hex}59`, color: hex }
                }
              >
                {ZONE_LABELS[zone]}
              </button>
            );
          })}
        </div>
        {items && <div className="flex flex-col gap-3">{items}</div>}
      </div>
    </div>
  );
}
