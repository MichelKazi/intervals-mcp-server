import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { MOOD_OPTIONS, type MoodKey, type MoodPickerProps } from './MoodPicker.types';

/**
 * @component MoodPicker
 * @description Trigger chip that opens a modal of selectable mood options with a
 *   fuzzy text filter. Picking one closes the modal and fires onChange.
 * @spec
 * - Closed: a 44px button showing the current mood label, or "Select mood".
 * - Open: an overlay dialog (role=dialog, aria-modal) with a text filter and a
 *   list of chips filtered by case-insensitive includes().
 * - Selecting a chip calls onChange(key) and closes.
 * - Escape and overlay click close without selecting.
 * @accessibility
 * - Trigger is a button; dialog has aria-label and a labelled filter input.
 */

function labelFor(value: string | null): string {
  return MOOD_OPTIONS.find((m) => m.key === value)?.label ?? '';
}

export function MoodPicker({ value, onChange, label = 'Mood', className }: MoodPickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFilter('');
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const q = filter.trim().toLowerCase();
  const matches = MOOD_OPTIONS.filter((m) => m.label.toLowerCase().includes(q));

  const select = (key: MoodKey) => {
    onChange(key);
    setOpen(false);
  };

  const current = labelFor(value);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-[44px] items-center rounded-full border border-border-default bg-bg-raised px-4 text-sm font-medium',
          current ? 'text-text-primary' : 'text-text-muted',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary',
          className,
        )}
      >
        {current || 'Select mood'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border-default bg-bg-surface p-4 sm:rounded-2xl"
          >
            <h2 className="mb-3 text-base font-semibold text-text-primary">{label}</h2>
            <input
              ref={inputRef}
              type="text"
              aria-label="Filter moods"
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="mb-3 h-10 w-full rounded-lg border border-border-default bg-bg-raised px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            />
            <div className="flex flex-wrap gap-2">
              {matches.length === 0 && (
                <p className="py-2 text-sm text-text-muted">No matches.</p>
              )}
              {matches.map((m) => {
                const selected = m.key === value;
                return (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => select(m.key)}
                    className={cn(
                      'min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors',
                      selected
                        ? 'border-accent-primary bg-accent-primary text-bg-base'
                        : 'border-border-default bg-bg-raised text-text-primary hover:border-accent-primary',
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
