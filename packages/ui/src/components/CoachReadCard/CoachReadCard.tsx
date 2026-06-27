import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import type { CoachReadCardProps } from './CoachReadCard.types';

/**
 * @component CoachReadCard
 * @description Read-only card previewing the coach's derived read of the athlete
 *   (training history + adherence pattern). Tapping opens the full text.
 * @spec
 * - Preview: 2-line truncated combined text of trainingHistory + dropoutRisk.
 * - Footer: "Updated {date}" when refreshedAt set, else "Not yet generated".
 * - Tap opens a modal showing both fields labelled "Training history" /
 *   "Adherence pattern". Empty fields render a muted "—".
 * - Never editable; this surfaces derived state only.
 * @accessibility
 * - Trigger is a button (aria-haspopup=dialog); dialog has aria-label.
 */

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function CoachReadCard({
  trainingHistory,
  dropoutRisk,
  refreshedAt,
  className,
}: CoachReadCardProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const history = trainingHistory?.trim() || '';
  const adherence = dropoutRisk?.trim() || '';
  const combined = [history, adherence].filter(Boolean).join(' · ');
  const hasContent = combined.length > 0;
  const date = formatDate(refreshedAt);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label="Coach read"
        onClick={() => setOpen(true)}
        disabled={!hasContent}
        className={cn(
          'flex w-full flex-col gap-1 text-left disabled:cursor-default',
          className,
        )}
      >
        <p
          className={cn(
            'line-clamp-2 text-sm',
            hasContent ? 'text-text-secondary' : 'text-text-muted',
          )}
        >
          {hasContent ? combined : 'The coach has not formed a read yet.'}
        </p>
        <span className="text-[11px] text-text-muted">
          {date ? `Updated ${date}` : 'Not yet generated'}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Coach read"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border-default bg-bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-4"
          >
            <h2 className="mb-3 text-base font-semibold text-text-primary">Coach read</h2>
            <section className="mb-4">
              <h3 className="mb-1 text-[11px] uppercase tracking-widest text-text-muted">
                Training history
              </h3>
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{history || '—'}</p>
            </section>
            <section>
              <h3 className="mb-1 text-[11px] uppercase tracking-widest text-text-muted">
                Adherence pattern
              </h3>
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{adherence || '—'}</p>
            </section>
            {date && <p className="mt-4 text-[11px] text-text-muted">Updated {date}</p>}
          </div>
        </div>
      )}
    </>
  );
}
