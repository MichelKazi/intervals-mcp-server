import { useState } from 'react';
import type { LibraryWorkout, WorkoutStep } from '../../lib/types';
import { formatDuration } from '../../lib/format';
import WorkoutChart from '../WorkoutChart';
import { createCustomWorkout, createEvent, getAlternatives } from '../../lib/api';

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
  onClose: () => void;
  onScheduled: () => void;
}

function PreviewInner({ workout, onClose, onScheduled }: PreviewInnerProps) {
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={workout.name}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          padding: 'var(--sp-4)',
          paddingBottom: 'calc(var(--sp-8) + env(safe-area-inset-bottom))',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-3)',
        }}
      >
        {/* Close / drag handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: 'var(--border)',
            margin: '0 auto var(--sp-4)',
          }}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          style={{
            position: 'absolute',
            top: 'var(--sp-4)',
            right: 'var(--sp-4)',
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 20,
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>

        {/* Name */}
        <h2 style={{ margin: '0 0 var(--sp-3)', fontSize: 18, fontWeight: 700 }}>{workout.name}</h2>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
          {workout.duration_secs != null && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div>
              <div style={{ fontWeight: 600 }}>{formatDuration(workout.duration_secs)}</div>
            </div>
          )}
          {workout.tss != null && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TSS</div>
              <div style={{ fontWeight: 600 }}>{Math.round(workout.tss)}</div>
            </div>
          )}
          {workout.interval_count != null && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Intervals</div>
              <div style={{ fontWeight: 600 }}>{workout.interval_count}</div>
            </div>
          )}
          {workout.intensity_min != null && workout.intensity_max != null && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Intensity</div>
              <div style={{ fontWeight: 600 }}>{workout.intensity_min}–{workout.intensity_max}%</div>
            </div>
          )}
        </div>

        {/* Zone chips */}
        {(workout.zone_focus ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
            {(workout.zone_focus ?? []).map(z => (
              <span
                key={z}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius)',
                  background: ZONE_COLORS[z] ?? 'var(--surface-2)',
                  color: '#fff',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}
              >
                {zoneLabel(z)}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {workout.description && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 'var(--sp-4)', lineHeight: 1.5 }}>
            {workout.description}
          </p>
        )}

        {/* Workout chart */}
        {steps && (
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <WorkoutChart steps={steps} />
          </div>
        )}

        {/* Schedule */}
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label
            htmlFor="schedule-date"
            style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 'var(--sp-2)' }}
          >
            Schedule date
          </label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              id="schedule-date"
              type="date"
              value={scheduleDate}
              onChange={e => { setScheduleDate(e.target.value); setStatus('idle'); }}
              style={{
                minHeight: 44,
                padding: '0 var(--sp-3)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: 14,
                fontFamily: 'var(--font)',
              }}
            />
            <button
              type="button"
              onClick={handleAddToCalendar}
              disabled={!scheduleDate || status === 'loading' || status === 'success'}
              style={{
                minHeight: 44,
                padding: '0 var(--sp-4)',
                background: 'var(--accent)',
                color: '#000',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'var(--font)',
                cursor: scheduleDate ? 'pointer' : 'not-allowed',
                opacity: scheduleDate ? 1 : 0.5,
              }}
            >
              {status === 'loading' ? 'Adding…' : status === 'success' ? 'Added!' : 'Add to calendar'}
            </button>
          </div>
          {status === 'error' && (
            <p style={{ color: 'var(--z5)', fontSize: 13, marginTop: 'var(--sp-2)' }}>{errorMsg}</p>
          )}
        </div>

        {/* Alternatives */}
        {workout.tr_workout_id && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 'var(--sp-2)' }}>
              Find alternatives
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
              {ALT_ADJUSTMENTS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  data-adjustment={value}
                  onClick={() => handleAltChip(value)}
                  aria-pressed={altAdjustment === value}
                  style={{
                    minHeight: 44,
                    padding: '0 var(--sp-3)',
                    background: altAdjustment === value ? 'var(--accent)' : 'var(--surface-2)',
                    color: altAdjustment === value ? '#000' : 'var(--text)',
                    border: `1px solid ${altAdjustment === value ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    fontSize: 13,
                    fontFamily: 'var(--font)',
                    cursor: 'pointer',
                    fontWeight: altAdjustment === value ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
              {altResults && (
                <button
                  type="button"
                  onClick={() => { setAltAdjustment(null); setAltResults(null); }}
                  style={{
                    minHeight: 44,
                    padding: '0 var(--sp-3)',
                    background: 'none',
                    color: 'var(--accent)',
                    border: 'none',
                    fontSize: 13,
                    fontFamily: 'var(--font)',
                    cursor: 'pointer',
                  }}
                >
                  ← Back to results
                </button>
              )}
            </div>

            {altLoading && (
              <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading alternatives…</p>
            )}
            {altResults && !altLoading && altResults.length === 0 && (
              <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No alternatives found.</p>
            )}
            {altResults && !altLoading && altResults.length > 0 && (
              <div>
                {altResults.map((w, idx) => (
                  <div
                    key={w.tr_workout_id ?? idx}
                    style={{
                      padding: 'var(--sp-3)',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius)',
                      marginBottom: 'var(--sp-2)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {w.duration_secs ? formatDuration(w.duration_secs) : '—'}
                      {w.tss != null ? ` · ${Math.round(w.tss)} TSS` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkoutPreviewSheet({ workout, onClose, onScheduled }: WorkoutPreviewSheetProps) {
  if (!workout) return null;
  return <PreviewInner workout={workout} onClose={onClose} onScheduled={onScheduled} />;
}
