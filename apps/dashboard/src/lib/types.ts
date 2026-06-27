export interface WorkoutStep {
  power?: { units: string; value?: number; start?: number; end?: number };
  hr?: { units: string; value?: number; start?: number; end?: number };
  duration?: number; // seconds
  distance?: number;
  warmup?: boolean;
  cooldown?: boolean;
  ramp?: boolean;
  intensity?: string;
  reps?: number;
  steps?: WorkoutStep[]; // repeat block
  text?: string;
}

export interface WorkoutDoc {
  steps: WorkoutStep[];
}

export interface PlannedEvent {
  id: number | string;
  name: string;
  type: string;
  category: string; // "WORKOUT" | ...
  start_date_local: string; // ISO
  end_date_local: string;
  moving_time?: number;
  distance?: number;
  icu_training_load?: number;
  icu_ctl?: number;
  icu_atl?: number;
  icu_intensity?: number;
  icu_ftp?: number;
  color?: string;
  description?: string;
  workout_doc?: WorkoutDoc;
  indoor?: boolean;
  start_date?: string; // date-only variant some payloads include alongside start_date_local
  sport_type?: string; // alias intervals.icu sometimes returns instead of `type`
  paired_activity_id?: number | string | null; // links a planned workout to its completed activity
  [key: string]: unknown; // intervals.icu returns many more fields; keep loose
}

export type Activity = PlannedEvent; // same shape, category differs

export type ComplianceVerdict = 'on_target' | 'under' | 'over' | 'unknown';

export interface Compliance {
  event_id: number | string;
  paired_activity_id: number | string | null;
  paired: boolean;
  planned: {
    load: number | null;
    duration: number | null;
  };
  actual: {
    load: number | null;
    duration: number | null;
    intensity: number | null;
  } | null;
  compliance: {
    load_pct: number | null;
    duration_pct: number | null;
    verdict: ComplianceVerdict;
  };
}

export interface Readiness {
  verdict: string; // "green" | "yellow" | "red"
  reasoning: string;
  score?: number; // 0–100 readiness score, when provided
  date?: string;
  computed_at?: string;
  confounds?: unknown[];
}

export interface Dashboard {
  next_workout: PlannedEvent | null;
  latest_activity: Activity | null;
  readiness: Readiness | null;
}

export interface WellnessDay {
  id: string;
  ctl?: number;
  atl?: number;
  rampRate?: number;
  hrv?: number;
  restingHR?: number;
  avgSleepingHR?: number;
  readiness?: number;
  fatigue?: number;
  [k: string]: unknown;
}

export interface IntervalLap {
  average_watts?: number;
  average_heartrate?: number;
  average_cadence?: number;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  min_watts?: number;
  max_watts?: number;
  label?: string;
  [k: string]: unknown;
}

export interface Stream {
  type: string;
  data: (number | null)[];
}

export interface ActivityIntervals {
  icu_intervals: IntervalLap[];
  icu_groups?: unknown[];
}

/** LLM-enriched assessment of a pre-computed FTP goal. */
export interface GoalAssessment {
  /** The PreComputedGoalContext echoed back from the backend. */
  computed: unknown;
  coaching_note: string;
  risk_factors: string[];
  /** Clamped server-side to [5, computed.baseConfidence]. */
  confidence_pct: number;
}

/** A persisted training plan (directeur-backed). */
export interface TrainingPlan {
  id: string;
  athlete_id?: string;
  name: string;
  /** The PreComputedGoalContext at build time. */
  goal: unknown;
  hard_weekdays: number[];
  weeks: number;
  start_date: string;
  /** The PlanSkeleton. */
  skeleton: unknown;
  status: string; // 'active' | 'archived'
  created_at?: string;
  updated_at?: string;
}

// ── Athlete coaching profile (DB-backed, editable via /api/profile*) ──

export interface AthleteDemographics {
  athlete_id?: string;
  name: string | null;
  birth_date: string | null;
  weight_kg: number | null;
  sex: string | null;
  gender_identity: string | null;
  location: string | null;
  timezone: string | null;
  [k: string]: unknown;
}

/** Hours of training time available per weekday. */
export type FreeTimeMap = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', number>
>;

export interface AthleteContext {
  athlete_id?: string;
  job_type: string | null;
  job_notes: string | null;
  /** Per-weekday available hours. Legacy rows may still hold a string. */
  free_time: FreeTimeMap | string | null;
  /** Lowercase mood key (energy/readiness), e.g. "energized". */
  mood: string | null;
  /** Self-rated motivation, 1-10. */
  motivation_score: number | null;
  /** Free-form note; server caps at 500 chars. */
  additional_notes: string | null;
  mesocycle_preference: string | null;
  /** Derived, read-only. Never PUT. */
  training_history_notes: string | null;
  /** Derived, read-only. Never PUT. */
  dropout_risk: string | null;
  /** ISO timestamp of the last coach-read refresh. */
  coach_read_refreshed_at: string | null;
  use_medical: boolean;
  use_lifestyle: boolean;
  use_psychological: boolean;
  profile_skill_md: string | null;
  [k: string]: unknown;
}

export interface Medication {
  id: string;
  athlete_id?: string;
  name: string;
  drug_class: string | null;
  schedule_weekday: number | null;
  notes: string | null;
  active: boolean;
  created_at?: string;
}

export interface AthleteProfile {
  athlete: AthleteDemographics | null;
  context: AthleteContext | null;
  medications: Medication[];
}

export interface LibraryWorkout {
  tr_workout_id?: string;
  name: string;
  duration_secs?: number;
  tss?: number;
  zone_focus?: string[];
  intensity_min?: number;
  intensity_max?: number;
  interval_count?: number;
  intervals_json?: unknown;
  description?: string;
  [k: string]: unknown;
}
