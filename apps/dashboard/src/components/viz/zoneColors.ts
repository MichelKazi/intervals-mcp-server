export type Zone = 1 | 2 | 3 | 4 | 5;

/** Hex color per training zone — endurance/tempo/threshold/vo2max/anaerobic. */
export const ZONE_COLORS: Record<Zone, string> = {
  1: '#3b82f6', // endurance
  2: '#eab308', // tempo
  3: '#f97316', // threshold
  4: '#ef4444', // vo2max
  5: '#a855f7', // anaerobic
};

export const ZONE_LABELS: Record<Zone, string> = {
  1: 'Endurance',
  2: 'Tempo',
  3: 'Threshold',
  4: 'VO2max',
  5: 'Anaerobic',
};
