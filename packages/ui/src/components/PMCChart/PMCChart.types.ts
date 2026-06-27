export interface PMCDataPoint {
  /** ISO date string. */
  date: string;
  /** Chronic Training Load (fitness). */
  ctl: number;
  /** Acute Training Load (fatigue). */
  atl: number;
  /** Training Stress Balance (form) = ctl - atl. */
  tsb: number;
}

export type PMCPeriod = '4w' | '8w' | '12w' | 'all';

export interface PMCChartProps {
  data: PMCDataPoint[];
  /** Window of trailing data to show. Default 'all'. */
  period?: PMCPeriod;
  /** Reserved: overlay FTP history. */
  showFTP?: boolean;
  ftpHistory?: { date: string; value: number }[];
  /** Render period toggle pills above the chart. Default false. */
  interactive?: boolean;
  className?: string;
}
