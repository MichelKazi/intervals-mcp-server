import { cn } from '../../lib/cn';
import { ZONE_COLORS } from '../../lib/zones';
import tokens from '../../tokens/generated/tokens';
import { ComplianceDot } from '../ComplianceDot';
import type { CalendarDay, CalendarWeekStripProps } from './CalendarWeekStrip.types';

/**
 * @component CalendarWeekStrip
 * @description Seven-day training week at a glance: each column shows the
 * weekday, date, a planned-vs-actual load bar pair, and a ComplianceDot.
 * Today, hard days, A-races, and the selected day get distinct emphasis.
 * @spec 7 columns. Bars scale to the week's max TSS (min 1). Planned bar uses
 * border.strong; actual uses ZONE_COLORS[zone] or accent.primary. isToday →
 * accent-filled date circle; isHardDay → 2px accent left border; isArace →
 * amber column tint + crown; selected → ring + raised bg.
 * @accessibility Each column button names the weekday, date, planned and
 * completed TSS, plus today/race/A-race state. ComplianceDot self-labels.
 */

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ARACE_TINT = `${tokens.color.status.caution}1f`;
const MAX_BAR_PX = 36;

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(day: CalendarDay): string {
  const weekday = WEEKDAY[day.date.getDay()];
  const parts = [
    `${weekday} ${day.date.getDate()}`,
    `planned ${day.plannedTSS} TSS`,
    `completed ${day.actualTSS} TSS`,
  ];
  if (day.isToday) parts.push('today');
  if (day.isArace) parts.push('A-race');
  else if (day.isRace) parts.push('race');
  if (day.isHardDay) parts.push('hard day');
  return parts.join(', ');
}

export function CalendarWeekStrip({ days, selectedDate, onSelectDate }: CalendarWeekStripProps) {
  const weekMax = Math.max(
    1,
    ...days.map((d) => Math.max(d.plannedTSS, d.actualTSS)),
  );

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const selected = selectedDate != null && sameDay(day.date, selectedDate);
        const actualColor = day.zone != null ? ZONE_COLORS[day.zone] : tokens.color.accent.primary;
        const plannedH = Math.round((day.plannedTSS / weekMax) * MAX_BAR_PX);
        const actualH = Math.round((day.actualTSS / weekMax) * MAX_BAR_PX);

        const inner = (
          <>
            <span className="text-[10px] font-semibold uppercase text-text-muted">
              {WEEKDAY[day.date.getDay()]}
            </span>
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center text-sm',
                day.isToday && 'rounded-full bg-accent-primary font-bold text-bg-base',
              )}
            >
              {day.isArace && (
                <span aria-hidden="true" className="-mt-3 absolute text-[10px]">
                  👑
                </span>
              )}
              {day.date.getDate()}
            </span>
            <span className="flex h-9 items-end gap-0.5" aria-hidden="true">
              <span
                className="w-1.5 rounded-sm bg-border-strong"
                style={{ height: Math.max(2, plannedH) }}
              />
              <span
                className="w-1.5 rounded-sm"
                style={{ height: Math.max(2, actualH), backgroundColor: actualColor }}
              />
            </span>
            <ComplianceDot planned={day.plannedTSS} actual={day.actualTSS} />
          </>
        );

        const columnClass = cn(
          'relative flex flex-col items-center gap-1.5 rounded-lg px-1 py-2',
          day.isHardDay && 'border-l-2',
          selected && 'bg-bg-raised ring-1 ring-accent-primary',
        );
        const columnStyle = {
          ...(day.isHardDay ? { borderLeftColor: tokens.color.accent.primary } : {}),
          ...(day.isArace ? { backgroundColor: ARACE_TINT } : {}),
        };

        if (onSelectDate) {
          return (
            <button
              key={day.date.toISOString()}
              type="button"
              onClick={() => onSelectDate(day.date)}
              aria-label={dayLabel(day)}
              aria-current={day.isToday ? 'date' : undefined}
              className={cn(
                columnClass,
                'outline-none transition active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-accent-primary',
              )}
              style={columnStyle}
            >
              {inner}
            </button>
          );
        }

        return (
          <div
            key={day.date.toISOString()}
            aria-label={dayLabel(day)}
            aria-current={day.isToday ? 'date' : undefined}
            className={columnClass}
            style={columnStyle}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
