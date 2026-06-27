export interface SparkLineProps {
  /** Series to plot, in order. Empty array renders a blank decorative svg. */
  data: number[];
  /** Stroke (and area gradient) color as any CSS color. Defaults to accent.primary. */
  color?: string;
  /** SVG width in px. */
  width?: number;
  /** SVG height in px. */
  height?: number;
  /** Draw the line left-to-right on mount via a stroke-dashoffset transition. */
  animated?: boolean;
  /** Fill below the line with a gradient fading from `color` to transparent. */
  showArea?: boolean;
  /** Draw a horizontal dashed reference line at this data value. */
  referenceValue?: number;
  className?: string;
}
