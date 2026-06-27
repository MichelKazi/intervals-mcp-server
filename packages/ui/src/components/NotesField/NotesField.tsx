import { cn } from '../../lib/cn';
import type { NotesFieldProps } from './NotesField.types';

/**
 * @component NotesField
 * @description Textarea with a hard character cap and a live counter.
 * @spec
 * - maxLength enforced on the textarea (default 500); onChange receives the
 *   capped value.
 * - Counter shows "X/max".
 * - Helper text clarifies the coach only sees that context was provided.
 * @accessibility
 * - aria-label on the textarea; counter is plain text.
 */

export function NotesField({
  value,
  onChange,
  maxLength = 500,
  label = 'Notes',
  placeholder,
  className,
}: NotesFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <textarea
        aria-label={label}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        className="min-h-[80px] w-full rounded-lg border border-border-default bg-bg-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">
          The coach only sees that context was provided.
        </span>
        <span className="font-mono text-[11px] tabular-nums text-text-muted">
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}
