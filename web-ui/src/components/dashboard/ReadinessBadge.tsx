import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { formatDate } from '../../lib/format';
import type { Readiness } from '../../lib/types';

interface ReadinessBadgeProps {
  readiness: Readiness;
}

const VERDICT_MAP: Record<string, { label: string; icon: string; badge: string }> = {
  green:  { label: 'Ready',    icon: '✓', badge: 'text-emerald-400 bg-emerald-400/15' },
  yellow: { label: 'Moderate', icon: '⚠', badge: 'text-yellow-400 bg-yellow-400/15' },
  red:    { label: 'Rest',     icon: '✗', badge: 'text-red-500 bg-red-500/15' },
};

/** Presentational badge for readiness verdict. Uses color AND text+icon for accessibility. */
export default function ReadinessBadge({ readiness }: ReadinessBadgeProps) {
  const [open, setOpen] = useState(false);
  const { verdict, reasoning, date, computed_at, confounds } = readiness;
  const config = VERDICT_MAP[verdict] ?? VERDICT_MAP.yellow;

  const timestampStr = computed_at ?? date;

  return (
    <>
      <section
        aria-label="Readiness"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(true); }}
        className="mx-4 mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-border bg-[var(--surface)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
      >
        <span
          aria-label={`Readiness: ${config.label}`}
          className={`inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-2 py-[3px] text-[13px] font-semibold whitespace-nowrap ${config.badge}`}
        >
          <span aria-hidden="true">{config.icon}</span>
          {config.label}
        </span>
        {reasoning && (
          <p
            className="m-0 flex-1 overflow-hidden text-[13px] leading-[1.4] text-[var(--text-dim)]"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {reasoning}
          </p>
        )}
        <ChevronRight className="ml-auto shrink-0 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-xl px-6 pt-6 pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
              <span
                className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-sm font-semibold ${config.badge}`}
                aria-hidden="true"
              >
                {config.icon} {config.label}
              </span>
              Readiness
            </SheetTitle>
            {timestampStr && (
              <p className="text-xs text-muted-foreground">
                {formatDate(timestampStr)}
              </p>
            )}
          </SheetHeader>

          {reasoning && (
            <SheetDescription className="text-sm leading-relaxed text-foreground mb-4">
              {reasoning}
            </SheetDescription>
          )}

          {confounds && confounds.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Confounds
              </p>
              <ul className="list-disc pl-4 space-y-1">
                {confounds.map((c, i) => (
                  <li key={i} className="text-sm text-foreground">
                    {String(c)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
