export interface ComplianceDotProps {
  /** Planned training load (e.g. TSS, duration). 0 or less = rest day. */
  planned: number;
  /** Actual completed load. */
  actual: number;
  /** Dot diameter. sm = 8px, md = 12px. Default sm. */
  size?: 'sm' | 'md';
  /** Render the compliance label text next to the dot. Default false. */
  showLabel?: boolean;
  className?: string;
}
