import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import { MetricRing, ContributorRow } from '@coaching/ui';
import { formatDate } from '../../lib/format';

type MetricRingStatus = 'good' | 'caution' | 'danger' | 'neutral';
import type { Readiness, WellnessDay } from '../../lib/types';

interface ReadinessCardProps {
  readiness: Readiness;
  /** Latest wellness day for the contributor breakdown (HRV / RHR / Sleep). */
  wellness?: WellnessDay | null;
  /** Form (TSB = CTL − ATL) for the contributor breakdown. */
  tsb?: number | null;
}

const STATUS = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
} as const;

const VERDICT_MAP: Record<
  string,
  { word: string; status: MetricRingStatus; color: string }
> = {
  green: { word: 'READY', status: 'good', color: STATUS.green },
  yellow: { word: 'MODERATE', status: 'caution', color: STATUS.yellow },
  red: { word: 'REST', status: 'danger', color: STATUS.red },
};

/** Map a 0–80ms HRV to a 0–100 score for the contributor bar. */
function hrvScore(hrv?: number | null): number | null {
  if (hrv == null) return null;
  return Math.max(0, Math.min(100, (hrv / 80) * 100));
}

/** Lower RHR is better. Map 40–70 bpm → 100–0. */
function rhrScore(rhr?: number | null): number | null {
  if (rhr == null) return null;
  return Math.max(0, Math.min(100, ((70 - rhr) / 30) * 100));
}

/** Map TSB −30..+15 → 0..100 (more form = higher score). */
function tsbScore(tsb?: number | null): number | null {
  if (tsb == null) return null;
  return Math.max(0, Math.min(100, ((tsb + 30) / 45) * 100));
}

/** Confounds arrive as an object map or an array; surface only meaningful ones. */
const BENIGN_CONFOUND = new Set(['none', 'clear', 'good', 'normal', 'ok']);

function normalizeConfounds(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v != null && !BENIGN_CONFOUND.has(String(v).toLowerCase()))
      .map(([k, v]) => `${k}: ${v}`);
  }
  return [String(raw)];
}

/**
 * Aura readiness hero: a gradient-stroke MetricRing arc with the verdict word and
 * a plain-English meaning, plus an optional confound pill. Tapping opens an
 * Oura-style contributor breakdown (HRV, RHR, Sleep, Form).
 */
export default function ReadinessCard({ readiness, wellness, tsb }: ReadinessCardProps) {
  const [open, setOpen] = useState(false);
  const { verdict, reasoning, date, computed_at } = readiness;
  const config = VERDICT_MAP[verdict] ?? VERDICT_MAP.yellow;
  const wellnessReadiness = typeof wellness?.readiness === 'number' ? wellness.readiness : null;
  const score = typeof readiness.score === 'number' ? readiness.score : wellnessReadiness;
  const timestampStr = computed_at ?? date;
  const confounds = normalizeConfounds(readiness.confounds);
  // MetricRing requires a non-empty meaning.
  const meaning = reasoning || 'Readiness computed from your morning metrics.';

  const hrv = hrvScore(wellness?.hrv as number | undefined);
  const rhr = rhrScore((wellness?.restingHR ?? wellness?.resting_hr) as number | undefined);
  const sleep = typeof wellness?.sleepScore === 'number' ? wellness.sleepScore : null;
  const form = tsbScore(tsb);

  const contributors: { label: string; score: number }[] = [
    hrv != null && { label: 'HRV', score: hrv },
    rhr != null && { label: 'RHR', score: rhr },
    sleep != null && { label: 'Sleep', score: sleep },
    form != null && { label: 'Form', score: form },
  ].filter(Boolean) as { label: string; score: number }[];

  return (
    <>
      <section
        aria-label="Readiness"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
        className="aura-glass aura-edge-light m-4 flex cursor-pointer select-none flex-col items-center rounded-2xl px-4 py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <MetricRing
          value={score ?? 0}
          max={100}
          status={config.status}
          statusWord={config.word}
          meaning={meaning}
          label="YOUR READINESS"
          confound={confounds[0] ? String(confounds[0]) : undefined}
          size="lg"
        />
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="px-6 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
              <span
                className="inline-flex items-center rounded-md px-2 py-1 text-sm font-semibold"
                style={{ color: config.color, backgroundColor: `${config.color}26` }}
              >
                {config.word}
              </span>
              Readiness
            </SheetTitle>
            {timestampStr && (
              <p className="text-xs text-muted-foreground">{formatDate(timestampStr)}</p>
            )}
          </SheetHeader>

          {reasoning && (
            <SheetDescription className="mb-5 text-sm leading-relaxed text-foreground">
              {reasoning}
            </SheetDescription>
          )}

          {contributors.length > 0 && (
            <div className="mb-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contributors
              </p>
              <div className="flex flex-col gap-3">
                {contributors.map((c) => (
                  <ContributorRow key={c.label} label={c.label} value={c.score} color={config.color} />
                ))}
              </div>
            </div>
          )}

          {confounds && confounds.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Confounds
              </p>
              <ul className="list-disc space-y-1 pl-4">
                {confounds.map((c, i) => (
                  <li key={i} className="text-sm text-foreground">{String(c)}</li>
                ))}
              </ul>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
