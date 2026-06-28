import { useState } from 'react';
import type { LibraryWorkout, WorkoutStep } from '../../lib/types';
import { formatDuration } from '../../lib/format';
import WorkoutChart from '../WorkoutChart';
import { createCustomWorkout, createEvent, getAlternatives } from '../../lib/api';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

const ZONE_COLORS: Record<string, string> = {
  endurance: 'var(--z2)',
  tempo: 'var(--z3)',
  sweet_spot: 'var(--z4)',
  threshold: 'var(--z5)',
  vo2max: 'var(--z6)',
  anaerobic: 'var(--z7)',
  recovery: 'var(--z1)',
};

function zoneLabel(zone: string): string {
  return zone.replace(/_/g, ' ');
}

const ALT_ADJUSTMENTS = [
  { label: 'Shorter', value: 'shorter' },
  { label: 'Longer', value: 'longer' },
  { label: 'Easier', value: 'easier' },
  { label: 'Harder', value: 'harder' },
  { label: 'Similar', value: 'similar' },
] as const;

/** Validate that intervals_json looks like an array of steps with duration + power. */
function toWorkoutSteps(raw: unknown): WorkoutStep[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0];
  if (typeof first !== 'object' || first === null) return null;
  if (!('duration' in first) && !('power' in first)) return null;
  return raw as WorkoutStep[];
}

interface WorkoutPreviewSheetProps {
  workout: LibraryWorkout | null;
  onClose: () => void;
  onScheduled: () => void;
}

interface PreviewInnerProps {
  workout: LibraryWorkout;
  onScheduled: () => void;
}

function PreviewInner({ workout, onScheduled }: PreviewInnerProps) {
  const [scheduleDate, setScheduleDate] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [altAdjustment, setAltAdjustment] = useState<string | null>(null);
  const [altResults, setAltResults] = useState<LibraryWorkout[] | null>(null);
  const [altLoading, setAltLoading] = useState(false);

  const steps = toWorkoutSteps(workout.intervals_json);

  async function handleAddToCalendar() {
    if (!scheduleDate) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      if (steps && workout.tr_workout_id) {
        await createCustomWorkout({
          name: workout.name,
          workout_type: 'Ride',
          steps,
          schedule_date: scheduleDate,
        });
      } else {
        await createEvent({
          name: workout.name,
          category: 'WORKOUT',
          start_date_local: scheduleDate + 'T00:00:00',
        });
      }
      setStatus('success');
      setTimeout(() => {
        onScheduled();
      }, 1500);
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Failed to schedule workout');
    }
  }

  async function handleAltChip(adjustment: string) {
    if (!workout.tr_workout_id) return;
    if (altAdjustment === adjustment) {
      setAltAdjustment(null);
      setAltResults(null);
      return;
    }
    setAltAdjustment(adjustment);
    setAltLoading(true);
    try {
      const results = await getAlternatives({ tr_workout_id: workout.tr_workout_id, adjustment });
      setAltResults(results);
    } catch {
      setAltResults([]);
    } finally {
      setAltLoading(false);
    }
  }

  return (
    <>
      {/* Drag handle is provided by SheetContent (base) — don't double it here. */}

      {/* Name */}
      <SheetTitle className="mb-3 text-lg font-bold">{workout.name}</SheetTitle>

      {/* Stats row */}
      <div className="mb-3 flex flex-wrap gap-4">
        {workout.duration_secs != null && (
          <div>
            <div className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Duration</div>
            <div className="font-semibold">{formatDuration(workout.duration_secs)}</div>
          </div>
        )}
        {workout.tss != null && (
          <div>
            <div className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground">TSS</div>
            <div className="font-semibold">{Math.round(workout.tss)}</div>
          </div>
        )}
        {workout.interval_count != null && (
          <div>
            <div className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Intervals</div>
            <div className="font-semibold">{workout.interval_count}</div>
          </div>
        )}
        {workout.intensity_min != null && workout.intensity_max != null && (
          <div>
            <div className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground">Intensity</div>
            <div className="font-semibold">{workout.intensity_min}–{workout.intensity_max}%</div>
          </div>
        )}
      </div>

      {/* Zone chips */}
      {(workout.zone_focus ?? []).length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {(workout.zone_focus ?? []).map(z => (
            <span
              key={z}
              className="rounded-md px-2.5 py-1 text-xs font-semibold capitalize text-white"
              style={{ background: ZONE_COLORS[z] ?? 'var(--surface-2)' }}
            >
              {zoneLabel(z)}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {workout.description && (
        <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
          {workout.description}
        </p>
      )}

      {/* Workout chart */}
      {steps && (
        <div className="mb-4">
          <WorkoutChart steps={steps} />
        </div>
      )}

      {/* Schedule */}
      <div className="mb-4">
        <label htmlFor="schedule-date" className="mb-2 block text-xs text-muted-foreground">
          Schedule date
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="schedule-date"
            type="date"
            value={scheduleDate}
            onChange={e => { setScheduleDate(e.target.value); setStatus('idle'); }}
            className="min-h-[44px] w-auto [color-scheme:dark]"
          />
          <Button
            type="button"
            onClick={handleAddToCalendar}
            disabled={!scheduleDate || status === 'loading' || status === 'success'}
            size="touch"
          >
            {status === 'loading' ? 'Adding…' : status === 'success' ? 'Added!' : 'Add to calendar'}
          </Button>
        </div>
        {status === 'error' && (
          <p className="mt-2 text-[13px]" style={{ color: 'var(--z5)' }}>{errorMsg}</p>
        )}
      </div>

      {/* Alternatives */}
      {workout.tr_workout_id && (
        <div>
          <div className="mb-2 text-xs text-muted-foreground">Find alternatives</div>
          <div className="mb-3 flex flex-wrap gap-2">
            {ALT_ADJUSTMENTS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                data-adjustment={value}
                onClick={() => handleAltChip(value)}
                aria-pressed={altAdjustment === value}
                className={cn(
                  'min-h-[44px] cursor-pointer rounded-md border px-3 text-[13px]',
                  altAdjustment === value
                    ? 'border-primary bg-primary font-semibold text-primary-foreground'
                    : 'border-border bg-muted font-normal text-foreground',
                )}
              >
                {label}
              </button>
            ))}
            {altResults && (
              <button
                type="button"
                onClick={() => { setAltAdjustment(null); setAltResults(null); }}
                className="min-h-[44px] cursor-pointer border-none bg-transparent text-[13px] text-primary"
              >
                ← Back to results
              </button>
            )}
          </div>

          {altLoading && (
            <p className="text-[13px] text-muted-foreground">Loading alternatives…</p>
          )}
          {altResults && !altLoading && altResults.length === 0 && (
            <p className="text-[13px] text-muted-foreground">No alternatives found.</p>
          )}
          {altResults && !altLoading && altResults.length > 0 && (
            <div>
              {altResults.map((w, idx) => (
                <div
                  key={w.tr_workout_id ?? idx}
                  className="mb-2 rounded-md bg-muted p-3"
                >
                  <div className="text-sm font-semibold">{w.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.duration_secs ? formatDuration(w.duration_secs) : '—'}
                    {w.tss != null ? ` · ${Math.round(w.tss)} TSS` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function WorkoutPreviewSheet({ workout, onClose, onScheduled }: WorkoutPreviewSheetProps) {
  return (
    <Sheet open={!!workout} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="bottom"
        aria-label={workout?.name}
        className="max-h-[85vh] overflow-y-auto p-4"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        {workout && (
          <PreviewInner
            key={workout.tr_workout_id ?? workout.name}
            workout={workout}
            onScheduled={onScheduled}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
