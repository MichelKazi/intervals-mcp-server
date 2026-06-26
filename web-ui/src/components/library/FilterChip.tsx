import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  active: boolean;
  color?: string;
  onToggle: () => void;
}

export default function FilterChip({ label, active, color, onToggle }: FilterChipProps) {
  // Active background/border is a runtime zone color — must stay inline.
  const activeColor = color ?? 'var(--brand)';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        'min-h-[44px] min-w-[44px] cursor-pointer whitespace-nowrap rounded-md border px-3 text-[13px] transition-colors',
        active
          ? 'font-semibold text-white'
          : 'border-border bg-muted font-normal text-foreground',
      )}
      style={
        active
          ? { background: activeColor, borderColor: activeColor }
          : undefined
      }
    >
      {label}
    </button>
  );
}
