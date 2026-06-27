import { cn } from '../../lib/cn';
import type { FreeTimeGridProps, FreeTimeMap, Weekday } from './FreeTimeGrid.types';

/**
 * @component FreeTimeGrid
 * @description Seven weekday rows, each a bounded segmented hours picker.
 * @spec
 * - Days Mon-Sun; hour options 0, 0.5, 1, 1.5, 2, 3+ (3+ stored as 3).
 * - Value is a partial {mon..sun: number}; onChange returns the full 7-day map.
 * - Compact: fits 390px width, options wrap if needed.
 * @accessibility
 * - Each row is a radiogroup labelled by the weekday; options are aria-pressed
 *   buttons.
 */

const DAYS: { key: Weekday; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: '0' },
  { value: 0.5, label: '½' },
  { value: 1, label: '1' },
  { value: 1.5, label: '1½' },
  { value: 2, label: '2' },
  { value: 3, label: '3+' },
];

function fullMap(value: Partial<FreeTimeMap> | null): FreeTimeMap {
  return DAYS.reduce((acc, d) => {
    acc[d.key] = value?.[d.key] ?? 0;
    return acc;
  }, {} as FreeTimeMap);
}

export function FreeTimeGrid({ value, onChange, className }: FreeTimeGridProps) {
  const map = fullMap(value);

  const set = (day: Weekday, hours: number) => {
    onChange({ ...map, [day]: hours });
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {DAYS.map((d) => (
        <div key={d.key} className="flex items-center gap-2">
          <span className="w-9 shrink-0 text-xs font-medium text-text-secondary">{d.label}</span>
          <div role="radiogroup" aria-label={`${d.label} hours`} className="flex flex-1 gap-1">
            {OPTIONS.map((o) => {
              const active = map[d.key] === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${d.label} ${o.label}`}
                  onClick={() => set(d.key, o.value)}
                  className={cn(
                    'min-h-[36px] flex-1 rounded-md text-xs font-medium tabular-nums transition-colors',
                    active
                      ? 'bg-accent-primary text-bg-base'
                      : 'bg-bg-raised text-text-secondary hover:text-text-primary',
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
