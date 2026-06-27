export interface ConfoundPillProps {
  /** Confound category. Drives the default label; color is always amber. */
  type: 'dose' | 'poor-sleep' | 'high-load' | 'travel' | 'custom';
  /** Overrides the default label. Required when type is 'custom'. */
  label?: string;
  className?: string;
}
