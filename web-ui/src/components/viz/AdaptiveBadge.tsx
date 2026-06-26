export interface AdaptiveBadgeProps {
  /** Intensity Factor. (Named `ifValue` because `if` is a reserved word.) */
  ifValue: number;
}

interface Tier {
  label: string;
  bg: string;
  text: string;
}

function tierFor(ifValue: number): Tier {
  if (ifValue < 0.85) return { label: 'Achievable', bg: '#22c55e26', text: '#22c55e' };
  if (ifValue < 0.95) return { label: 'Productive', bg: '#3b82f626', text: '#3b82f6' };
  if (ifValue <= 1.0) return { label: 'Stretch', bg: '#f59e0b26', text: '#f59e0b' };
  return { label: 'Breakthrough', bg: '#ef444426', text: '#ef4444' };
}

/** Derives an effort label + color from an Intensity Factor. */
export default function AdaptiveBadge({ ifValue }: AdaptiveBadgeProps) {
  const { label, bg, text } = tierFor(ifValue);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}
