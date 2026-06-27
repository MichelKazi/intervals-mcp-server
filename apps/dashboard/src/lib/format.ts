/** Default FTP fallback when no athlete FTP is available. */
export const DEFAULT_FTP = 250;

/** "1h08m" or "45m" */
export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

/** "265w" */
export function formatWatts(n: number): string {
  return `${Math.round(n)}w`;
}

/** Locale date string from ISO */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/** Short day like "Mon" */
export function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short' });
}

/** Meters to km with 1 decimal */
export function kmFromMeters(m: number): string {
  return (m / 1000).toFixed(1);
}

/** "31.1 km" from meters; empty string when missing */
export function formatDistance(meters?: number | null): string {
  if (!meters) return '';
  return `${kmFromMeters(meters)} km`;
}

/** Coggan-ish zone color token (CSS var string like "var(--z3)") */
export function zoneColor(pctFtp: number): string {
  if (pctFtp < 56) return 'var(--z1)';
  if (pctFtp <= 75) return 'var(--z2)';
  if (pctFtp <= 87) return 'var(--z3)';
  if (pctFtp <= 94) return 'var(--z4)';
  if (pctFtp <= 105) return 'var(--z5)';
  if (pctFtp <= 120) return 'var(--z6)';
  return 'var(--z7)';
}

/**
 * Map a %FTP intensity to a 1–5 training zone matching the viz ZoneDot palette
 * (1 endurance · 2 tempo · 3 threshold · 4 vo2max · 5 anaerobic).
 */
export function ftpToZone(pctFtp: number): 1 | 2 | 3 | 4 | 5 {
  if (pctFtp <= 75) return 1;
  if (pctFtp <= 90) return 2;
  if (pctFtp <= 105) return 3;
  if (pctFtp <= 120) return 4;
  return 5;
}

/** Zone name string */
export function zoneName(pctFtp: number): string {
  if (pctFtp < 56) return 'recovery';
  if (pctFtp <= 75) return 'endurance';
  if (pctFtp <= 87) return 'tempo';
  if (pctFtp <= 94) return 'sweet spot';
  if (pctFtp <= 105) return 'threshold';
  if (pctFtp <= 120) return 'vo2max';
  return 'anaerobic';
}
