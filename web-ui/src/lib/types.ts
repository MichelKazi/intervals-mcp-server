// Core domain types for the intervals coaching UI

export interface WorkoutStep {
  duration?: number;
  power?: { units: 'percent' | 'watts'; value: number };
  text?: string;
  reps?: number;
  steps?: WorkoutStep[];
}

export interface WorkoutDoc {
  steps?: WorkoutStep[];
  description?: string;
}

export interface PlannedEvent {
  id: number | string;
  name: string;
  sport_type?: string;
  start_date?: string;
  moving_time?: number;          // seconds
  icu_training_load?: number;
  icu_ftp?: number;
  workout_doc?: WorkoutDoc;
  description?: string;
}

export interface Activity {
  id: number | string;
  name: string;
  type?: string;
  sport_type?: string;
  start_date?: string;
  moving_time?: number;          // seconds
  distance?: number;             // meters
  icu_training_load?: number;
}

export interface ActivityIntervals {
  id: number | string;
  laps?: IntervalLap[];
}

export interface IntervalLap {
  average_watts?: number;
  moving_time?: number;
  elapsed_time?: number;
  label?: string;
}

export interface Stream {
  type: string;
  data: number[];
}

export interface Readiness {
  verdict: 'green' | 'yellow' | 'red';
  reasoning?: string;
  score?: number;
}

export interface Dashboard {
  next_workout: PlannedEvent | null;
  latest_activity: Activity | null;
  readiness: Readiness | null;
}

export interface LibraryWorkout {
  id: string;
  name: string;
  duration?: number;
  tss?: number;
  zone_focus?: string[];
  adaptation_target?: string;
  interval_pattern?: string;
  description?: string;
  steps?: WorkoutStep[];
}

export interface WellnessDay {
  date: string;
  ctl?: number;
  atl?: number;
  tsb?: number;
  hrv?: number;
  restingHR?: number;
  weight?: number;
}
