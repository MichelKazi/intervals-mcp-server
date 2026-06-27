/**
 * Reconcile-on-read plan adjustment.
 *
 * No background scheduler. When the plan/dashboard is opened, diff the stored
 * skeleton against what actually happened (completed activities) plus the
 * latest readiness verdict, and surface deterministic adjustments. Directeur's
 * coaching layer can add prose on top, but the triggers below are computed, so
 * the UI reacts instantly and the logic is testable without an LLM.
 *
 * Honest scope: this is reconcile-on-read, not an autopilot that pushes nudges
 * on its own. It runs when you look. A true background watcher is a follow-up.
 */

import type { PlanSkeleton, DayType } from './plan';

export type AdjustmentKind =
  | 'missed_days_recovery' // took time off → treat as recovery, shift block
  | 'overreaching' // going too hard / TSB tanking → insert easy day
  | 'undertraining' // not enough hard work landing → flag
  | 'on_track';

export interface ReconcileInput {
  skeleton: PlanSkeleton;
  /** ISO dates of completed activities in the plan window */
  completedDates: string[];
  /** per-date training load (TSS) actually done, keyed by ISO date */
  actualLoadByDate?: Record<string, number>;
  /** latest readiness verdict from directeur: 'green' | 'yellow' | 'red' */
  readiness?: 'green' | 'yellow' | 'red' | null;
  /** latest TSB (form); strongly negative = fatigued */
  tsb?: number | null;
  /** today, for "which days are in the past" */
  now?: Date;
}

export interface Adjustment {
  kind: AdjustmentKind;
  /** short headline */
  title: string;
  /** what to do */
  detail: string;
  /** ISO date the adjustment targets, if any */
  date?: string;
  severity: 'info' | 'warn';
}

const MISSED_STREAK_FOR_RECOVERY = 3; // consecutive planned non-rest days missed
const TSB_OVERREACH = -25; // form this low = fatigue risk

function isPast(dateIso: string, today: Date): boolean {
  return new Date(dateIso + 'T00:00:00').getTime() < today.setHours(0, 0, 0, 0);
}

export function reconcilePlan(input: ReconcileInput): Adjustment[] {
  const today = input.now ?? new Date();
  const todayCopy = new Date(today);
  const done = new Set(input.completedDates);
  const adjustments: Adjustment[] = [];

  // Flatten past planned training days (skip rest + future).
  const trainingTypes: DayType[] = ['hard', 'endurance', 'recovery'];
  const pastTraining = input.skeleton.weeks
    .flatMap((w) => w.days)
    .filter((d) => trainingTypes.includes(d.type) && isPast(d.date, new Date(todayCopy)));

  // 1. Missed streak → treat as recovery, recommend shifting the block.
  let streak = 0;
  let maxStreak = 0;
  let streakEnd: string | undefined;
  for (const d of pastTraining) {
    if (!done.has(d.date)) {
      streak++;
      if (streak >= maxStreak) {
        maxStreak = streak;
        streakEnd = d.date;
      }
    } else {
      streak = 0;
    }
  }
  if (maxStreak >= MISSED_STREAK_FOR_RECOVERY) {
    adjustments.push({
      kind: 'missed_days_recovery',
      title: `${maxStreak} planned days missed`,
      detail:
        'Treating that gap as recovery. Shift the remaining build weeks forward so you ramp from where you actually are, not where the plan assumed.',
      date: streakEnd,
      severity: 'warn',
    });
  }

  // 2. Overreaching → readiness red or TSB deeply negative → insert an easy day.
  const fatigued =
    input.readiness === 'red' || (typeof input.tsb === 'number' && input.tsb <= TSB_OVERREACH);
  if (fatigued) {
    // next upcoming hard day
    const nextHard = input.skeleton.weeks
      .flatMap((w) => w.days)
      .find((d) => d.type === 'hard' && !isPast(d.date, new Date(todayCopy)));
    adjustments.push({
      kind: 'overreaching',
      title: 'Fatigue building',
      detail: nextHard
        ? `Form is low. Swap the ${nextHard.date} hard session for endurance, or take a rest day before it.`
        : 'Form is low — add an easy day before your next hard session.',
      date: nextHard?.date,
      severity: 'warn',
    });
  }

  // 3. Undertraining → enough time elapsed but few hard sessions actually done.
  const pastHard = pastTraining.filter((d) => d.type === 'hard');
  const hardDone = pastHard.filter((d) => done.has(d.date)).length;
  if (pastHard.length >= 4 && hardDone / pastHard.length < 0.5 && !fatigued) {
    adjustments.push({
      kind: 'undertraining',
      title: 'Hard sessions slipping',
      detail: `Only ${hardDone} of ${pastHard.length} planned hard sessions done. The FTP target assumes the intensity lands — protect these days or pull the goal date back.`,
      severity: 'warn',
    });
  }

  if (adjustments.length === 0) {
    adjustments.push({
      kind: 'on_track',
      title: 'On track',
      detail: 'Recent sessions match the plan. Keep going.',
      severity: 'info',
    });
  }

  return adjustments;
}
