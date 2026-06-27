import { cn } from '../../lib/cn';
import type { CalendarTemplateProps, CalendarView } from './CalendarTemplate.types';

/**
 * @component CalendarTemplate
 * @description Calendar screen layout: view toggle, week/month strip, day list, optional bottom sheet.
 * @spec
 * - Root: aura-mesh-bg min-h-screen, content max-w-md mx-auto, p-4, pb-20.
 * - Week/month toggle: two pill buttons, aria-pressed reflects `view`, click calls onViewChange.
 * - weekStrip below toggle, dayList below that.
 * - drawer: when provided, fixed inset-x-0 bottom-0 aura-glass rounded-t-2xl p-5, max-w-md mx-auto.
 * @accessibility
 * - Toggle buttons expose aria-pressed; drawer is a region labelled "Details".
 */

const VIEWS: CalendarView[] = ['week', 'month'];

export function CalendarTemplate({
  view = 'week',
  onViewChange,
  weekStrip,
  dayList,
  drawer,
  className,
}: CalendarTemplateProps) {
  return (
    <div className={cn('aura-mesh-bg min-h-screen', className)}>
      <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-20">
        <div className="flex gap-2" role="group" aria-label="Calendar view">
          {VIEWS.map((v) => {
            const active = view === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={active}
                onClick={() => onViewChange?.(v)}
                className={cn(
                  'rounded-full px-4 py-1.5 font-ui text-sm font-bold capitalize transition-colors',
                  active
                    ? 'bg-accent-primary text-bg-base'
                    : 'bg-bg-surface text-text-secondary',
                )}
              >
                {v}
              </button>
            );
          })}
        </div>
        {weekStrip}
        {dayList && <div className="flex flex-col gap-3">{dayList}</div>}
      </div>
      {drawer && (
        <div
          role="region"
          aria-label="Details"
          className="fixed inset-x-0 bottom-0 mx-auto max-w-md rounded-t-2xl p-5 aura-glass"
        >
          {drawer}
        </div>
      )}
    </div>
  );
}
