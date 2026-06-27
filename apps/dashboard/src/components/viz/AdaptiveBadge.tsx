export interface AdaptiveBadgeProps {
  /** Intensity Factor. (Named `ifValue` because `if` is a reserved word.) */
  ifValue: number;
}

interface Tier {
  label: string;
  bg: string;
  text: string;
}

// Text shades are 400-level (brighter than the 15% tint background) so each
// pill clears WCAG AA 4.5:1 on the dark card.
function tierFor(ifValue: number): Tier {
  if (ifValue < 0.85) return { label: 'Achievable', bg: '#22c55e26', text: '#4ade80' };
  if (ifValue < 0.95) return { label: 'Productive', bg: '#3b82f626', text: '#60a5fa' };
  if (ifValue <= 1.0) return { label: 'Stretch', bg: '#f59e0b26', text: '#fbbf24' };
  return { label: 'Breakthrough', bg: '#ef444426', text: '#f87171' };
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
