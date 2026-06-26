interface FilterChipProps {
  label: string;
  active: boolean;
  color?: string;
  onToggle: () => void;
}

export default function FilterChip({ label, active, color, onToggle }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      style={{
        minHeight: 44,
        minWidth: 44,
        padding: '0 var(--sp-3)',
        background: active ? (color ?? 'var(--accent)') : 'var(--surface-2)',
        color: active ? '#fff' : 'var(--text)',
        border: `1px solid ${active ? (color ?? 'var(--accent)') : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        fontSize: 13,
        fontFamily: 'var(--font)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontWeight: active ? 600 : 400,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {label}
    </button>
  );
}
