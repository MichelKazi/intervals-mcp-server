export interface SparkLineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  className?: string;
}

/** Stroke-only mini line chart — no axes, no fill. */
export default function SparkLine({
  data,
  color,
  width = 60,
  height = 20,
  className,
}: SparkLineProps) {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 1.5;
  const usableH = height - pad * 2;
  const step = data.length > 1 ? width / (data.length - 1) : 0;

  const points = data
    .map((d, i) => {
      const x = i * step;
      const y = pad + usableH * (1 - (d - min) / range);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
