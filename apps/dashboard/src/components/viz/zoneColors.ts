export type Zone = 1 | 2 | 3 | 4 | 5;

/** Hex color per training zone — endurance/tempo/threshold/vo2max/anaerobic. */
export const ZONE_COLORS: Record<Zone, string> = {
  1: '#3b82f6', // endurance
  2: '#eab308', // tempo
  3: '#f97316', // threshold
  4: '#ef4444', // vo2max
  5: '#a855f7', // anaerobic
};

/**
 * Brighter text shades for zone badges. The raw ZONE_COLORS sit at ~4.4:1 as
 * text on their own 15% tint over the dark card — just under WCAG AA. These
 * 400-level shades clear 4.5:1 while reading as the same zone.
 */
export const ZONE_TEXT: Record<Zone, string> = {
  1: '#60a5fa', // blue-400
  2: '#facc15', // yellow-400
  3: '#fb923c', // orange-400
  4: '#f87171', // red-400
  5: '#c084fc', // purple-400
};

export const ZONE_LABELS: Record<Zone, string> = {
  1: 'Endurance',
  2: 'Tempo',
  3: 'Threshold',
  4: 'VO2max',
  5: 'Anaerobic',
};
