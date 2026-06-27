/** Mood options, energy/readiness focused. Stored value is the lowercase key. */
export const MOOD_OPTIONS = [
  { key: 'energized', label: 'Energized' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'steady', label: 'Steady' },
  { key: 'tired', label: 'Tired' },
  { key: 'drained', label: 'Drained' },
  { key: 'stressed', label: 'Stressed' },
  { key: 'unmotivated', label: 'Unmotivated' },
  { key: 'anxious', label: 'Anxious' },
] as const;

export type MoodKey = (typeof MOOD_OPTIONS)[number]['key'];

export interface MoodPickerProps {
  /** Current mood key, or null when unset. */
  value: string | null;
  /** Fires with the selected mood key. */
  onChange: (value: MoodKey) => void;
  /** Accessible label / dialog title. Default "Mood". */
  label?: string;
  className?: string;
}
