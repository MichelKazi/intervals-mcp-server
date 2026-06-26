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
