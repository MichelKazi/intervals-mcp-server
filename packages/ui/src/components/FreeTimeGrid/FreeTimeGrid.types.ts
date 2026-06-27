export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Hours of training time available per weekday. */
export type FreeTimeMap = Record<Weekday, number>;

export interface FreeTimeGridProps {
  /** Per-day hours. Missing days default to 0. */
  value: Partial<FreeTimeMap> | null;
  /** Fires with the full 7-day map on any change. */
  onChange: (value: FreeTimeMap) => void;
  className?: string;
}
