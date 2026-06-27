import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  active: boolean;
  color?: string;
  onToggle: () => void;
}

export default function FilterChip({ label, active, color, onToggle }: FilterChipProps) {
  // Active tint/border/text are a runtime zone color — must stay inline.
  const zoneColor = color ?? 'var(--brand)';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        'min-h-[44px] min-w-[44px] cursor-pointer whitespace-nowrap rounded-full border px-4 text-[13px] transition-colors',
        active
          ? 'font-semibold'
          : 'border-border bg-muted/60 font-normal text-muted-foreground hover:text-foreground',
      )}
      style={
        active
          ? {
              // filled-tint: low-alpha zone fill, zone border, zone text
              background: `color-mix(in srgb, ${zoneColor} 18%, transparent)`,
              borderColor: zoneColor,
              color: zoneColor,
            }
          : undefined
      }
    >
      {label}
    </button>
  );
}
