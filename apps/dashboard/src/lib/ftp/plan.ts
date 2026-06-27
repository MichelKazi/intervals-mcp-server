/**
 * Deterministic training-plan skeleton.
 *
 * Same boundary as the FTP goal compute: all structure (which day is hard vs
 * endurance vs recovery vs rest, mesocycle cadence, spacing rules) is computed
 * here, synchronously, with zero LLM involvement. Directeur only fills the
 * actual workout content into the hard/endurance slots this produces.
 *
 * Rules (from FTP_GOAL_SCIENCE.md + MICHEL constants):
 *  - Polarized: hard days are the minority; everything else is endurance/rest.
 *  - Max hard days/week = what the rider picks (2 or 3).
 *  - Thursday (injection day) is never hard — forced to endurance or rest.
 *  - Hard days must be >= 48h apart: no two adjacent weekdays.
 *  - 3-week mesocycle: 2 build weeks + 1 recovery week (no hard days, lower load).
 *  - At least one full rest day per week.
 */

import { MICHEL } from './constants';

export type DayType = 'hard' | 'endurance' | 'recovery' | 'rest';

// 0 = Monday … 6 = Sunday (matches MICHEL.INJECTION_DAY_INDEX convention).
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const INJECTION_WEEKDAY = 3; // Thursday — never hard
export const MESO_BUILD_WEEKS = 2;
export const MESO_TOTAL_WEEKS = 3; // 2 build + 1 recovery

export interface PlanDay {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** 0=Mon … 6=Sun */
  weekday: number;
  type: DayType;
  weekNumber: number; // 1-based
  isRecoveryWeek: boolean;
}

export interface PlanWeek {
  weekNumber: number;
  isRecoveryWeek: boolean;
  days: PlanDay[];
}

export interface PlanSkeletonInput {
  /** weekdays (0=Mon..6=Sun) the rider wants hard sessions on; 2 or 3 entries */
  hardWeekdays: number[];
  /** total plan length in weeks */
  weeks: number;
  /** ISO start date (defaults to the next Monday) */
  startDate?: string;
  now?: Date;
}

export interface PlanSkeleton {
  weeks: PlanWeek[];
  hardWeekdays: number[];
  /** spacing violations the rider should know about (adjacent hard days) */
  spacingWarnings: string[];
  /** Thursday was requested but moved off (injection day) */
  injectionConflict: boolean;
  totalHardSessions: number;
  startDate: string;
}

/** Next Monday on/after `from`. */
function nextMonday(from: Date): Date {
  const d = new Date(from);
  const dow = (d.getDay() + 6) % 7; // 0=Mon
  const add = dow === 0 ? 0 : 7 - dow;
  d.setDate(d.getDate() + add);
  return d;
}

function isoAddDays(start: Date, days: number): string {
  const d = new Date(start);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True if two weekdays sit on adjacent calendar days (e.g. Tue+Wed). */
function adjacent(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  return diff === 1 || diff === 6; // 6 = Sun↔Mon wrap
}

export function buildPlanSkeleton(input: PlanSkeletonInput): PlanSkeleton {
  const today = input.now ?? new Date();
  const start = input.startDate ? new Date(input.startDate + 'T00:00:00') : nextMonday(today);
  const startIso = start.toISOString().slice(0, 10);

  // Drop Thursday from hard picks (injection day), dedupe, sort.
  const requested = [...new Set(input.hardWeekdays)].sort((a, b) => a - b);
  const injectionConflict = requested.includes(INJECTION_WEEKDAY);
  const hardWeekdays = requested.filter((d) => d !== INJECTION_WEEKDAY);

  // Spacing: flag any two chosen hard days that are calendar-adjacent.
  const spacingWarnings: string[] = [];
  for (let i = 0; i < hardWeekdays.length; i++) {
    for (let j = i + 1; j < hardWeekdays.length; j++) {
      if (adjacent(hardWeekdays[i], hardWeekdays[j])) {
        spacingWarnings.push(
          `${WEEKDAY_LABELS[hardWeekdays[i]]} and ${WEEKDAY_LABELS[hardWeekdays[j]]} are back-to-back — less than 48h between hard days.`,
        );
      }
    }
  }

  const weeks: PlanWeek[] = [];
  let totalHardSessions = 0;

  for (let w = 0; w < input.weeks; w++) {
    const weekNumber = w + 1;
    const isRecoveryWeek = w % MESO_TOTAL_WEEKS === MESO_TOTAL_WEEKS - 1;
    const days: PlanDay[] = [];

    for (let wd = 0; wd < 7; wd++) {
      const date = isoAddDays(start, w * 7 + wd);
      let type: DayType;

      if (isRecoveryWeek) {
        // Recovery week: only light endurance, Monday + Thursday rest.
        type = wd === 0 || wd === INJECTION_WEEKDAY ? 'rest' : 'recovery';
      } else if (hardWeekdays.includes(wd)) {
        type = 'hard';
        totalHardSessions++;
      } else if (wd === 0) {
        type = 'rest'; // Monday rest by default
      } else {
        type = 'endurance';
      }

      days.push({ date, weekday: wd, type, weekNumber, isRecoveryWeek });
    }

    weeks.push({ weekNumber, isRecoveryWeek, days });
  }

  return {
    weeks,
    hardWeekdays,
    spacingWarnings,
    injectionConflict,
    totalHardSessions,
    startDate: startIso,
  };
}

/** Color token per day type — drives the calendar preview dots. */
export const DAY_TYPE_COLOR: Record<DayType, string> = {
  hard: 'bg-zone-3', // orange — intensity
  endurance: 'bg-zone-1', // blue — aerobic
  recovery: 'bg-status-yellow', // amber — recovery week
  rest: 'bg-slate-700', // muted — rest
};

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  hard: 'Hard',
  endurance: 'Endurance',
  recovery: 'Recovery',
  rest: 'Rest',
};

/** Map a full or abbreviated weekday name to its 0=Mon..6=Sun index. */
function weekdayIndex(name: string): number {
  return WEEKDAY_LABELS.findIndex((label) => name.toLowerCase().startsWith(label.toLowerCase()));
}

/** Default suggested hard days: the athlete's known good slots, minus Thursday. */
export function defaultHardWeekdays(): number[] {
  const slots = MICHEL.HARD_DAY_SLOTS.map(weekdayIndex).filter(
    (i) => i >= 0 && i !== INJECTION_WEEKDAY,
  );
  // Guarantee the picker's 2-day minimum even if the constant is sparse.
  return slots.length >= 2 ? slots : [1, 4]; // Tue + Fri
}
