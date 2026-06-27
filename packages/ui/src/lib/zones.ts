import tokens from '../tokens/generated/tokens';

export type Zone = 1 | 2 | 3 | 4 | 5;

/** Hex per training zone, sourced from tokens (never hardcode). */
export const ZONE_COLORS: Record<Zone, string> = {
  1: tokens.color.zone['1'],
  2: tokens.color.zone['2'],
  3: tokens.color.zone['3'],
  4: tokens.color.zone['4'],
  5: tokens.color.zone['5'],
};

export const ZONE_LABELS: Record<Zone, string> = {
  1: 'Endurance',
  2: 'Tempo',
  3: 'Threshold',
  4: 'VO2max',
  5: 'Anaerobic',
};

export const STATUS_COLORS = {
  good: tokens.color.status.good,
  caution: tokens.color.status.caution,
  danger: tokens.color.status.danger,
} as const;
