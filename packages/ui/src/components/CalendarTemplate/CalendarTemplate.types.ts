import type { ReactNode } from 'react';

export type CalendarView = 'week' | 'month';

export interface CalendarTemplateProps {
  /** Active view. Default 'week'. */
  view?: CalendarView;
  /** Fires when a view pill is clicked. */
  onViewChange?: (view: CalendarView) => void;
  /** CalendarWeekStrip slot. */
  weekStrip?: ReactNode;
  /** Activities for the selected day. */
  dayList?: ReactNode;
  /** Bottom-sheet content; renders a fixed sheet when provided. */
  drawer?: ReactNode;
  className?: string;
}
