import type { Zone } from '../../lib/zones';

export interface CalendarDay {
  date: Date;
  plannedTSS: number;
  actualTSS: number;
  zone?: Zone;
  isToday?: boolean;
  isHardDay?: boolean;
  isRace?: boolean;
  isArace?: boolean;
}

export interface CalendarWeekStripProps {
  /** Always 7 days, Monday-first by convention. */
  days: CalendarDay[];
  /** Highlights the matching day (by calendar date). */
  selectedDate?: Date;
  /** When set, each column is a button firing with the day's date. */
  onSelectDate?: (date: Date) => void;
}
