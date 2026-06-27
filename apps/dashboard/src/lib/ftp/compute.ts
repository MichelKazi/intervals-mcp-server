/**
 * FTP Goal pre-computation.
 *
 * All deterministic math runs here, synchronously, in the browser — so the UI
 * gives instant validation with zero LLM wait. Directeur later receives this
 * PreComputedGoalContext (never raw inputs) and only adds a coaching note,
 * risk factors, and a confidence adjustment.
 */

import {
  FTP_PCT_BOUNDS,
  RETURNING_ATHLETE_HARD_MULTIPLIER,
  MIN_GOAL_DAYS,
  PLAN_TEMPLATES,
  VALIDATION_MESSAGES,
  MICHEL,
  minCTLForFTP,
  weeksToTargetCTL,
  scoreAchievability,
  confidencePct,
  trainingTierFromCtl,
  type Achievability,
  type PlanTemplateKey,
  type TrainingTier,
} from './constants';

export interface FTPGoalInput {
  currentFtp: number;
  targetFtp: number;
  /** ISO date (YYYY-MM-DD) */
  targetDate: string;
  currentCtl: number;
  weightKg?: number;
  /** documented historical peak; defaults to MICHEL.ALL_TIME_PEAK_FTP */
  allTimePeakFtp?: number;
  /** override "today" for tests; defaults to now */
  now?: Date;
}

export interface PreComputedGoalContext {
  input: FTPGoalInput;

  gainRequired: number;
  gainPct: number;
  weeksAvailable: number;
  daysAvailable: number;
  gainPerWeek: number;
  gainPctPerWeek: number;

  isPhysicallyPossible: boolean;
  exceedsHardLimit: boolean;
  exceedsAllTimePeak: boolean;
  belowCurrentFtp: boolean;
  tooShortDuration: boolean;
  isReturningTowardPeak: boolean;
  hardLimitWatts: number;
  softLimitWatts: number;

  ctlSufficient: boolean;
  minCtlRequired: number;
  weeksToRequiredCtl: number;

  achievability: Achievability;
  baseConfidence: number;

  planTemplateKey: PlanTemplateKey;
  planTemplate: (typeof PLAN_TEMPLATES)[PlanTemplateKey];

  validationMessage: string;
  returningAdvantageNote: string | null;

  trainingTier: TrainingTier;
}

function boundsForWeeks(weeks: number): { soft: number; hard: number } {
  for (const b of FTP_PCT_BOUNDS) {
    if (weeks <= b.weeks) return { soft: b.soft, hard: b.hard };
  }
  // Beyond the longest row, hold the last (6-month) bound.
  const last = FTP_PCT_BOUNDS[FTP_PCT_BOUNDS.length - 1];
  return { soft: last.soft, hard: last.hard };
}

function planTemplateKey(weeks: number): PlanTemplateKey {
  if (weeks <= 5) return '4w';
  if (weeks <= 10) return '8w';
  if (weeks <= 16) return '12w';
  return '20w';
}

export function preComputeGoal(input: FTPGoalInput): PreComputedGoalContext {
  const allTimePeak = input.allTimePeakFtp ?? MICHEL.ALL_TIME_PEAK_FTP;
  const today = input.now ?? new Date();
  const target = new Date(input.targetDate + 'T00:00:00');
  const daysAvailable = Math.floor(
    (target.getTime() - today.getTime()) / 86_400_000,
  );
  const weeksAvailable = daysAvailable / 7;
  const gainRequired = input.targetFtp - input.currentFtp;
  const gainPct = gainRequired / input.currentFtp;
  const gainPerWeek = weeksAvailable > 0 ? gainRequired / weeksAvailable : Infinity;
  const gainPctPerWeek = weeksAvailable > 0 ? gainPct / weeksAvailable : Infinity;

  const { soft, hard } = boundsForWeeks(weeksAvailable);
  const isReturningTowardPeak =
    input.targetFtp <= allTimePeak && input.currentFtp < allTimePeak;
  const effectiveHardPct = isReturningTowardPeak
    ? hard * RETURNING_ATHLETE_HARD_MULTIPLIER
    : hard;

  const softLimitWatts = Math.round(input.currentFtp * soft);
  const hardLimitWatts = Math.round(input.currentFtp * effectiveHardPct);

  const exceedsHardLimit = gainRequired > hardLimitWatts;
  const exceedsAllTimePeak = input.targetFtp > allTimePeak;
  const belowCurrentFtp = gainRequired <= 0;
  const tooShortDuration = daysAvailable < MIN_GOAL_DAYS;
  const isPhysicallyPossible =
    !exceedsHardLimit &&
    !exceedsAllTimePeak &&
    !belowCurrentFtp &&
    !tooShortDuration;

  const minCtlRequired = minCTLForFTP(input.targetFtp);
  const ctlSufficient = input.currentCtl >= minCtlRequired;
  const weeksToRequiredCtl = weeksToTargetCTL(input.currentCtl, minCtlRequired);

  const achievability = scoreAchievability(gainPctPerWeek);
  const baseConfidence = confidencePct(achievability);

  const key = planTemplateKey(weeksAvailable);
  const roundedWeeks = Math.round(weeksAvailable);

  const validationMessage = (() => {
    if (belowCurrentFtp) return VALIDATION_MESSAGES.BELOW_CURRENT();
    if (tooShortDuration) return VALIDATION_MESSAGES.MIN_DURATION(MIN_GOAL_DAYS);
    if (exceedsAllTimePeak)
      return VALIDATION_MESSAGES.EXCEEDS_PEAK(allTimePeak);
    if (exceedsHardLimit)
      return VALIDATION_MESSAGES.HARD_REJECT(
        gainRequired,
        roundedWeeks,
        hardLimitWatts,
        gainPct,
      );
    if (achievability === 'aggressive')
      return VALIDATION_MESSAGES.AGGRESSIVE(gainRequired, roundedWeeks);
    if (achievability === 'moderate')
      return VALIDATION_MESSAGES.MODERATE(gainRequired, roundedWeeks);
    return VALIDATION_MESSAGES.CONSERVATIVE(gainRequired, roundedWeeks);
  })();

  const returningAdvantageNote =
    isReturningTowardPeak && isPhysicallyPossible
      ? VALIDATION_MESSAGES.RETURNING_ADVANTAGE(allTimePeak)
      : null;

  return {
    input,
    gainRequired,
    gainPct,
    weeksAvailable,
    daysAvailable,
    gainPerWeek,
    gainPctPerWeek,
    isPhysicallyPossible,
    exceedsHardLimit,
    exceedsAllTimePeak,
    belowCurrentFtp,
    tooShortDuration,
    isReturningTowardPeak,
    hardLimitWatts,
    softLimitWatts,
    ctlSufficient,
    minCtlRequired,
    weeksToRequiredCtl,
    achievability,
    baseConfidence,
    planTemplateKey: key,
    planTemplate: PLAN_TEMPLATES[key],
    validationMessage,
    returningAdvantageNote,
    trainingTier: trainingTierFromCtl(input.currentCtl),
  };
}
