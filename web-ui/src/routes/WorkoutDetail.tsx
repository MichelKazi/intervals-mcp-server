import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AppShell from '../components/AppShell';
import WorkoutChart from '../components/WorkoutChart';
import MetricStrip from '../components/workout/MetricStrip';
import LapList from '../components/workout/LapList';
import ActionRow from '../components/workout/ActionRow';
import AlternativesSheet from '../components/workout/AlternativesSheet';
import {
  getEvent,
  getActivity,
  getActivityIntervals,
  getAlternatives,
  updateEvent,
} from '../lib/api';
import type { PlannedEvent, ActivityIntervals, LibraryWorkout } from '../lib/types';
import { formatDate, DEFAULT_FTP } from '../lib/format';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBar({ width = '100%', height = 16 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-sm)',
        animation: 'skeleton-pulse 1.4s ease-in-out infinite',
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:.6} 50%{opacity:.3} }`}</style>
      {/* Chart placeholder */}
      <SkeletonBar height={220} />
      {/* Metric strip */}
      <div style={{ display: 'flex', gap: 'var(--sp-4)', justifyContent: 'space-around' }}>
        <SkeletonBar width={60} height={36} />
        <SkeletonBar width={60} height={36} />
        <SkeletonBar width={60} height={36} />
      </div>
      {/* Action row */}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <SkeletonBar height={44} />
        <SkeletonBar height={44} />
      </div>
    </div>
  );
}

// ── Edit form ─────────────────────────────────────────────────────────────────

interface EditFormProps {
  event: PlannedEvent;
  onClose: () => void;
  onSaved: () => void;
}

function EditForm({ event, onClose, onSaved }: EditFormProps) {
  const [name, setName] = useState(event.name);
  const [dateStr, setDateStr] = useState(
    event.start_date_local ? event.start_date_local.slice(0, 10) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateEvent(event.id, {
        name,
        start_date_local: dateStr ? `${dateStr}T00:00:00` : undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      style={{
        margin: '0 var(--sp-4) var(--sp-4)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        padding: 'var(--sp-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
      }}
    >
      <h2
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          margin: 0,
        }}
      >
        Edit workout
      </h2>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Name</span>
        <input
          data-testid="edit-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            padding: 'var(--sp-2) var(--sp-3)',
            fontSize: 15,
            minHeight: 44,
            fontFamily: 'var(--font)',
          }}
        />
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Date</span>
        <input
          data-testid="edit-date-input"
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            padding: 'var(--sp-2) var(--sp-3)',
            fontSize: 15,
            minHeight: 44,
            colorScheme: 'dark',
            fontFamily: 'var(--font)',
          }}
        />
      </label>

      {error && (
        <div style={{ fontSize: 13, color: '#e84040' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            flex: 1,
            minHeight: 44,
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: '#000',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 1,
            minHeight: 44,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Description ───────────────────────────────────────────────────────────────

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_LEN = 200;
  const isLong = text.length > PREVIEW_LEN;

  return (
    <div style={{ margin: '0 var(--sp-4) var(--sp-4)' }}>
      <h2
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          margin: '0 0 var(--sp-2)',
        }}
      >
        Description
      </h2>
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          padding: 'var(--sp-3) var(--sp-4)',
        }}
      >
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-dim)',
            lineHeight: 1.5,
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}
        >
          {isLong && !expanded ? text.slice(0, PREVIEW_LEN) + '…' : text}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: 13,
              cursor: 'pointer',
              padding: 'var(--sp-2) 0 0',
              fontFamily: 'var(--font)',
              minHeight: 44,
            }}
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [selectedLapIdx, setSelectedLapIdx] = useState<number | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [altParams, setAltParams] = useState<Record<string, string | number> | null>(null);

  // Fetch event (planned workout); may 404 for completed activities
  const {
    data: eventData,
    isLoading: eventDataLoading,
    isError: eventFailed,
  } = useQuery<PlannedEvent>({
    queryKey: ['event', id],
    queryFn: () => getEvent(id!),
    enabled: !!id,
    retry: 0,
  });

  // Fallback: fetch as activity if event 404s
  const {
    data: activityData,
    isLoading: activityLoading,
    isError: activityFailed,
    refetch: refetchEvent,
  } = useQuery<PlannedEvent>({
    queryKey: ['activity', id],
    queryFn: () => getActivity(id!),
    enabled: !!id && eventFailed,
    retry: 1,
  });

  const event = eventData ?? activityData;
  const eventLoading = eventDataLoading || (eventFailed && activityLoading);
  const eventError = eventFailed && activityFailed;

  // Fetch intervals (for completed activities)
  const {
    data: intervals,
  } = useQuery<ActivityIntervals>({
    queryKey: ['activity-intervals', id],
    queryFn: () => getActivityIntervals(id!),
    enabled: !!id,
    retry: 1,
  });

  // Fetch alternatives (on demand)
  const {
    data: alternativesData,
    isLoading: altLoading,
    isError: altError,
  } = useQuery<LibraryWorkout[]>({
    queryKey: ['alternatives', altParams],
    queryFn: () => getAlternatives(altParams ?? {}),
    enabled: showAlternatives && altParams !== null,
    retry: 1,
  });

  // Invalidate event on mutations
  const invalidateEvent = () => {
    queryClient.invalidateQueries({ queryKey: ['event', id] });
  };

  function handleFindAlternatives() {
    if (!event) return;
    const params: Record<string, string | number> = {};
    if (event.moving_time) params.duration_secs = event.moving_time;
    if (event.icu_training_load) params.tss = event.icu_training_load;
    setAltParams(params);
    setShowAlternatives(true);
  }

  const laps = intervals?.icu_intervals ?? [];
  const hasSteps = (event?.workout_doc?.steps?.length ?? 0) > 0;
  const hasLaps = laps.length > 0;
  const ftp = (event as PlannedEvent & { icu_ftp?: number })?.icu_ftp ?? DEFAULT_FTP;

  const title = event?.name ?? (eventLoading ? 'Loading…' : 'Workout');

  // ── Derived: which chart source to use ──
  // Prefer planned steps if available; fall back to laps
  const chartSteps = hasSteps ? event!.workout_doc!.steps : undefined;
  const chartLaps = !hasSteps && hasLaps ? laps : undefined;

  return (
    <AppShell title={title} showBack>
      {eventLoading && <LoadingSkeleton />}

      {!eventLoading && eventError && (
        <div style={{ padding: 'var(--sp-4)', color: 'var(--text-dim)', textAlign: 'center' }}>
          <p>Could not load workout.</p>
          <button
            onClick={() => refetchEvent()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              padding: 'var(--sp-2) var(--sp-4)',
              cursor: 'pointer',
              fontSize: 14,
              minHeight: 44,
              fontFamily: 'var(--font)',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!eventLoading && !eventError && !event && (
        <div style={{ padding: 'var(--sp-4)', color: 'var(--text-dim)' }}>
          Workout details unavailable.
        </div>
      )}

      {!eventLoading && event && (
        <>
          {/* Date line */}
          <div
            style={{
              padding: 'var(--sp-2) var(--sp-4) 0',
              fontSize: 12,
              color: 'var(--text-dim)',
            }}
          >
            {formatDate(event.start_date_local)}
          </div>

          {/* Chart hero — ~40vh, visually dominant */}
          <div
            data-testid="chart-container"
            style={{
              padding: 'var(--sp-4)',
              paddingBottom: 'var(--sp-2)',
            }}
          >
            {chartSteps || chartLaps ? (
              <WorkoutChart
                steps={chartSteps}
                laps={chartLaps}
                ftp={ftp}
              />
            ) : (
              <div
                style={{
                  height: 220,
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-dim)',
                  fontSize: 13,
                }}
              >
                No workout data
              </div>
            )}
          </div>

          {/* Metric strip — dimmer, secondary */}
          <MetricStrip event={event} />

          {/* Actions — for planned workouts */}
          {event.category === 'WORKOUT' && !hasLaps && (
            <ActionRow
              eventId={event.id}
              onDone={invalidateEvent}
              onMoved={invalidateEvent}
              onFindAlternatives={handleFindAlternatives}
              onEditClick={() => setShowEdit((s) => !s)}
            />
          )}

          {/* Edit form */}
          {showEdit && (
            <EditForm
              event={event}
              onClose={() => setShowEdit(false)}
              onSaved={invalidateEvent}
            />
          )}

          {/* Alternatives */}
          {showAlternatives && (
            <AlternativesSheet
              alternatives={alternativesData ?? []}
              loading={altLoading}
              error={altError ? 'error' : null}
            />
          )}

          {/* Lap breakdown — for completed activities */}
          {hasLaps && (
            <LapList
              laps={laps}
              selectedLapIdx={selectedLapIdx}
              onSelectLap={(idx) => setSelectedLapIdx(idx === selectedLapIdx ? null : idx)}
            />
          )}

          {/* Description */}
          {event.description && <Description text={event.description} />}
        </>
      )}
    </AppShell>
  );
}
