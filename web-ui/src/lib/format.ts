// Formatting utilities for display

/** Format seconds into m:ss or h:mm:ss */
export function formatDuration(secs?: number | null): string {
  if (!secs || secs <= 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Format watts as "###w" */
export function formatWatts(watts?: number | null): string {
  if (watts == null) return '—';
  return `${Math.round(watts)}w`;
}

/** Format a date string as "Mon, Jun 30" */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Short 3-letter weekday: "Mon" */
export function shortDay(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Zone color by % FTP.
 * Mirrors the tokens in tokens.css.
 */
export function zoneColor(pctFtp: number): string {
  if (pctFtp < 56) return 'var(--z1)';   // recovery
  if (pctFtp < 76) return 'var(--z2)';   // endurance
  if (pctFtp < 91) return 'var(--z3)';   // tempo
  if (pctFtp < 106) return 'var(--z4)';  // sweet spot / threshold
  if (pctFtp < 121) return 'var(--z5)';  // threshold / FTP
  if (pctFtp < 151) return 'var(--z6)';  // vo2max
  return 'var(--z7)';                     // anaerobic
}

/** Human-readable zone name */
export function zoneName(pctFtp: number): string {
  if (pctFtp < 56) return 'Recovery';
  if (pctFtp < 76) return 'Endurance';
  if (pctFtp < 91) return 'Tempo';
  if (pctFtp < 106) return 'Sweet Spot';
  if (pctFtp < 121) return 'Threshold';
  if (pctFtp < 151) return 'VO2max';
  return 'Anaerobic';
}

/** Format distance in meters to km or miles (km) */
export function formatDistance(meters?: number | null): string {
  if (!meters) return '';
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}
