import type { Zone } from '../../lib/zones';

export interface PowerInterval {
  /** Duration of this segment in seconds; drives bar width. */
  durationSecs: number;
  /** Power as a fraction of FTP, e.g. 1.10 = 110% FTP; drives bar height. */
  powerPct: number;
  /** Training zone 1-5; drives bar color. */
  zone: Zone;
  label?: string;
  isWarmup?: boolean;
  isCooldown?: boolean;
  isRecovery?: boolean;
}

export interface PowerChartProps {
  intervals: PowerInterval[];
  /** Draw the dashed 100% FTP hairline. Default true. */
  ftpLine?: boolean;
  /** Fill bars with a vertical gradient. Default true. */
  gradientBars?: boolean;
  /** Allow tapping/keyboard-focusing bars to reveal interval detail. */
  interactive?: boolean;
  /** Plain-English session summary. REQUIRED for any zone>=3 session. */
  summary?: string;
  /** Chart height in px. Default 90. */
  height?: number;
  /** Show a zone color legend for the zones present. */
  showLegend?: boolean;
  className?: string;
}
