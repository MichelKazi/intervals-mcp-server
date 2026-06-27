import { cn } from '../../lib/cn';
import tokens from '../../tokens/generated/tokens';
import type { MotivationSliderProps } from './MotivationSlider.types';

/**
 * @component MotivationSlider
 * @description 1-10 range slider whose track runs red (low) to green (high).
 * @spec
 * - Native range input, min 1, max 10, step 1; controlled value/onChange.
 * - Track painted with a red→green linear gradient from status tokens.
 * - Current number rendered beside the track.
 * - 44px minimum touch target on the control row.
 * @accessibility
 * - role=slider with aria-valuemin/max/now (native input provides these);
 *   aria-label from `label`.
 */

const MIN = 1;
const MAX = 10;

const TRACK_GRADIENT = `linear-gradient(to right, ${tokens.color.status.danger} 0%, ${tokens.color.status.caution} 50%, ${tokens.color.status.good} 100%)`;

export function MotivationSlider({
  value,
  onChange,
  label = 'Motivation',
  className,
}: MotivationSliderProps) {
  const clamped = Math.min(MAX, Math.max(MIN, Math.round(value)));

  return (
    <div className={cn('flex min-h-[44px] items-center gap-3', className)}>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={1}
        value={clamped}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="motivation-slider h-2 flex-1 cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
        style={{ background: TRACK_GRADIENT }}
      />
      <span className="w-7 shrink-0 text-right font-mono text-base font-bold tabular-nums text-text-primary">
        {clamped}
      </span>
      <style>{`
        .motivation-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid rgba(0,0,0,0.35);
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
          cursor: pointer;
        }
        .motivation-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid rgba(0,0,0,0.35);
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
