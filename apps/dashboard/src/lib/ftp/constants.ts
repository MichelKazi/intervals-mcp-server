/**
 * FTP Goal Science Constants
 *
 * Single source of truth for the quantitative values that govern FTP-goal
 * validation. Extracted from FTP_GOAL_SCIENCE.md. Numbers live here, not in any
 * skill prompt — DeepSeek only reasons over pre-computed values.
 *
 * DEVIATION FROM THE ORIGINAL SPEC, ON PURPOSE:
 * The spec listed absolute-watt hard limits (e.g. 35W / 12 weeks). The science
 * doc — which Phase 1 names as the source of truth — expresses every bound as a
 * PERCENT of current FTP for a *trained* cyclist, and explicitly says beginners
 * and returning riders exceed those (Topic 5, "Recommendations" table). A fixed
 * watt ceiling is wrong for two riders at different FTPs and ignores Michel's
 * 363W documented peak vs 290W now. So limits are percentages here, converted to
 * watts against current FTP at call time. See FTP_GOAL_SCIENCE.md "Recommendations".
 */

export interface PctBound {
  /** weeks this row applies up to (inclusive) */
  weeks: number;
  /** soft-warning gain, fraction of current FTP (e.g. 0.03 = 3%) */
  soft: number;
  /** hard-limit gain, fraction of current FTP */
  hard: number;
}

// ─── Gain limits as % of current FTP, by time window ─────────────────────────
// Source: FTP_GOAL_SCIENCE.md "Recommendations — Input-Validation Bounds" table.
// "Gains are expressed as % FTP change for a trained cyclist." Rows use the
// upper number of each doc range as the threshold.
export const FTP_PCT_BOUNDS: readonly PctBound[] = [
  { weeks: 5 / 7, soft: 0.01, hard: 0.03 }, // 5 days
  { weeks: 2, soft: 0.02, hard: 0.04 }, // 2 weeks
  { weeks: 4, soft: 0.04, hard: 0.07 }, // 4 weeks
  { weeks: 8, soft: 0.06, hard: 0.1 }, // 8 weeks
  { weeks: 12, soft: 0.1, hard: 0.15 }, // 12 weeks
  { weeks: 26, soft: 0.15, hard: 0.3 }, // 6 months
] as const;

/**
 * Returning-athlete multiplier on the hard limit. The doc (Topic 5, table notes)
 * says detrained/returning riders can exceed trained bounds when targeting a
 * documented prior peak — but is explicit that retraining-is-faster is only
 * case-study evidence, not RCT. So this is a modest 1.5x, applied ONLY to gains
 * that stay at or below the documented historical peak.
 */
export const RETURNING_ATHLETE_HARD_MULTIPLIER = 1.5;

// ─── Detraining loss rate ────────────────────────────────────────────────────
// Source: Coyle 1984 / reviews, ~3 W/week comparable to the doc's ~3-5%/2wk.
export const MAX_LOSS_PER_WEEK_PCT = 0.025;

// ─── CTL→FTP heuristic ratios (W per CTL point) ──────────────────────────────
// FTP_GOAL_SCIENCE.md Topic 2 is emphatic: NO peer-reviewed CTL→FTP constant
// exists. These are soft anchors only and must be surfaced as heuristic.
export const CTL_FTP_RATIOS = {
  POPULATION_MIN: 2.6,
  POPULATION_MEAN: 2.9,
  POPULATION_MAX: 3.3,
  // Michel-specific, grounded from intervals.icu (2026-06-26 pull):
  // modeled FTP 363W on 2022-04-09 / CTL 92.8 that day = 3.91 W/CTL.
  // Exceeds population max — real, personal, used as a soft ceiling anchor.
  MICHEL_AT_PEAK: 3.91 as number | null,
  // Current 266W modeled / CTL 48 = 5.55 is a detrained-freshness artifact,
  // not a usable ratio. Left null on purpose.
  MICHEL_CURRENT: null as number | null,
} as const;

/** Minimum CTL that typically supports a target FTP. Heuristic — see Topic 2. */
export function minCTLForFTP(targetFtp: number, useMichelRatio = true): number {
  const ratio =
    useMichelRatio && CTL_FTP_RATIOS.MICHEL_AT_PEAK
      ? CTL_FTP_RATIOS.MICHEL_AT_PEAK
      : CTL_FTP_RATIOS.POPULATION_MEAN;
  return Math.ceil(targetFtp / ratio);
}

// ─── CTL ramp-rate limits (CTL points/week) ──────────────────────────────────
// Source: Friel/TrainingPeaks heuristic, FTP_GOAL_SCIENCE.md Topic 4. Heuristic.
export const CTL_RAMP_RATES = { SAFE: 5, AGGRESSIVE: 8, DANGER: 10 } as const;

export function weeksToTargetCTL(
  currentCtl: number,
  targetCtl: number,
  rampRate: number = CTL_RAMP_RATES.SAFE,
): number {
  return Math.ceil(Math.max(0, targetCtl - currentCtl) / rampRate);
}

// ─── Polarized distribution ──────────────────────────────────────────────────
// Source: Seiler 80/20, Neal 2013 — FTP_GOAL_SCIENCE.md Topic 3.
export const POLARIZED_DISTRIBUTION = {
  Z1_TARGET: 0.8,
  GREY_ZONE_MAX: 0.05,
  HIGH_INTENSITY_TARGET: 0.15,
  HIGH_INTENSITY_BUILD_MAX: 0.2,
} as const;

// ─── Minimum duration ────────────────────────────────────────────────────────
// Below 14 days there is no meaningful threshold adaptation (doc Topic 1/4).
export const MIN_GOAL_DAYS = 14;

// ─── Achievability scoring (gain per week as % of current FTP) ───────────────
// The doc's headline rule: "treat sustained gains above ~1.5%/week as suspect."
// Bands below sit under that ceiling for trained riders.
export const ACHIEVABILITY_PCT_PER_WEEK = {
  CONSERVATIVE_MAX: 0.004, // <=0.4%/wk
  MODERATE_MAX: 0.008, // <=0.8%/wk
  AGGRESSIVE_MAX: 0.015, // <=1.5%/wk — the doc's suspect ceiling
} as const;

export type Achievability =
  | 'conservative'
  | 'moderate'
  | 'aggressive'
  | 'unrealistic';

export function scoreAchievability(gainPctPerWeek: number): Achievability {
  if (gainPctPerWeek <= ACHIEVABILITY_PCT_PER_WEEK.CONSERVATIVE_MAX)
    return 'conservative';
  if (gainPctPerWeek <= ACHIEVABILITY_PCT_PER_WEEK.MODERATE_MAX)
    return 'moderate';
  if (gainPctPerWeek <= ACHIEVABILITY_PCT_PER_WEEK.AGGRESSIVE_MAX)
    return 'aggressive';
  return 'unrealistic';
}

export function confidencePct(a: Achievability): number {
  const BASE: Record<Achievability, number> = {
    conservative: 92,
    moderate: 78,
    aggressive: 52,
    unrealistic: 5,
  };
  return BASE[a];
}

// ─── Athlete tier from CTL ───────────────────────────────────────────────────
export type TrainingTier =
  | 'untrained'
  | 'trained'
  | 'well_trained'
  | 'highly_trained'
  | 'elite';

export function trainingTierFromCtl(ctl: number): TrainingTier {
  if (ctl < 30) return 'untrained';
  if (ctl < 60) return 'trained';
  if (ctl < 90) return 'well_trained';
  if (ctl < 120) return 'highly_trained';
  return 'elite';
}

// ─── Michel personal constants ───────────────────────────────────────────────
// Grounded from intervals.icu (athlete i334094, pulled 2026-06-26). See
// memory reference_michel_ftp_data. icu_pm_ftp = modeled FTP, icu_ftp = set FTP.
export const MICHEL = {
  ALL_TIME_PEAK_FTP: 363, // modeled, 2022-04-09
  ALL_TIME_PEAK_CTL: 125, // 124.9, 2021-05-14
  CURRENT_FTP: 290, // set FTP; overridden at runtime from live data
  CURRENT_CTL: 48, // 47.9; overridden at runtime
  // Schedule constraints — used by the plan builder skill.
  INJECTION_DAY: 'Thursday',
  HARD_DAY_SLOTS: ['Tuesday', 'Friday'],
  TRAP_PATTERN: 'high_intensity_low_volume', // 2023 — never recommend
} as const;

// ─── Plan templates by horizon ───────────────────────────────────────────────
// expected_gain is now % of current FTP (consistent with the doc).
export const PLAN_TEMPLATES = {
  '4w': {
    label: '4-Week Block',
    expectedGainPct: { min: 0.02, max: 0.04 },
    phases: ['build_2w', 'recovery_1w', 'test_1w'],
    hardSessionsPerWeek: 2,
    primaryWorkout: 'Over-Unders',
    intermediateTests: 0,
  },
  '8w': {
    label: '8-Week Block',
    expectedGainPct: { min: 0.04, max: 0.07 },
    phases: ['base_2w', 'build_3w', 'recovery_1w', 'peak_1w', 'test_1w'],
    hardSessionsPerWeek: 2,
    primaryWorkout: 'Over-Unders → Threshold',
    intermediateTests: 0,
  },
  '12w': {
    label: '12-Week Block',
    expectedGainPct: { min: 0.06, max: 0.1 },
    phases: ['base_3w', 'build_3w', 'recovery_1w', 'build_3w', 'peak_1w', 'test_1w'],
    hardSessionsPerWeek: 2,
    primaryWorkout: 'Z1 base → Over-Unders → 30:15s',
    intermediateTests: 1,
  },
  '20w': {
    label: '20-Week Block (Returning Athlete)',
    expectedGainPct: { min: 0.1, max: 0.2 },
    phases: ['ctl_rebuild_6w', 'base_4w', 'build_4w', 'peak_4w', 'taper_1w', 'test_1w'],
    hardSessionsPerWeek: 2,
    primaryWorkout: 'Z1 volume → Over-Unders → Threshold → VO2',
    intermediateTests: 2,
  },
} as const;

export type PlanTemplateKey = keyof typeof PLAN_TEMPLATES;

// ─── Validation message templates ────────────────────────────────────────────
// Deterministic. Interpolate values before render. {pct} is rounded to 1 dp.
const pct1 = (f: number) => `${(f * 100).toFixed(1)}%`;

export const VALIDATION_MESSAGES = {
  HARD_REJECT: (gainW: number, weeks: number, ceilingW: number, gainPct: number) =>
    `Gaining ${gainW}W (${pct1(gainPct)}) in ${weeks} weeks isn't physiologically realistic for a trained rider. ` +
    `The published ceiling for this window is about ${ceilingW}W.`,

  EXCEEDS_PEAK: (peakFtp: number) =>
    `Your documented peak is ${peakFtp}W. Going beyond that is a multi-year project, not one block. ` +
    `Set a stepping-stone target below ${peakFtp}W.`,

  CTL_INSUFFICIENT: (currentCtl: number, targetFtp: number, requiredCtl: number) =>
    `Your current base (CTL ${currentCtl}) typically supports an FTP around ` +
    `${Math.round(currentCtl * CTL_FTP_RATIOS.POPULATION_MEAN)}W. ` +
    `For ${targetFtp}W you'd want CTL near ${requiredCtl}. The plan builds both — ` +
    `CTL→FTP is a heuristic, not a hard law.`,

  AGGRESSIVE: (gainW: number, weeks: number) =>
    `${gainW}W in ${weeks} weeks is ambitious — top-quartile for a trained rider. ` +
    `Achievable with near-perfect execution and no illness.`,

  MODERATE: (gainW: number, weeks: number) =>
    `${gainW}W in ${weeks} weeks is within a normal trained-rider response. Solid goal with consistent work.`,

  CONSERVATIVE: (gainW: number, weeks: number) =>
    `${gainW}W in ${weeks} weeks is conservative and high-confidence. Good anchor target.`,

  RETURNING_ADVANTAGE: (peakFtp: number) =>
    `You've held ${peakFtp}W before, so a faster return toward that level is plausible — ` +
    `though regaining-faster-than-building is only case-study evidence, not proven.`,

  BELOW_CURRENT: () =>
    `That's at or below your current FTP. Did you mean a maintenance goal?`,

  MIN_DURATION: (minDays: number) =>
    `Pick a target date at least ${minDays} days out so the body has time to adapt.`,
} as const;
