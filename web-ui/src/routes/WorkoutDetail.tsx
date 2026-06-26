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
  getActivities,
  getCompliance,
  pairActivity,
  unpairActivity,
  updateEvent,
} from '../lib/api';
import type {
  PlannedEvent,
  ActivityIntervals,
  LibraryWorkout,
  Activity,
  Compliance,
  ComplianceVerdict,
} from '../lib/types';
import { formatDate, formatDuration, DEFAULT_FTP } from '../lib/format';

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

// ── Compliance ──────────────────────────────────────────────────────────────

const VERDICT_META: Record<ComplianceVerdict, { label: string; color: string }> = {
  on_target: { label: 'On target', color: 'var(--z2)' }, // green
  under: { label: 'Under', color: 'var(--z3)' }, // yellow
  over: { label: 'Over', color: 'var(--z1)' }, // blue
  unknown: { label: 'Unknown', color: 'var(--text-dim)' },
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </h2>
  );
}

function ComplianceRow({
  label,
  planned,
  actual,
  pct,
}: {
  label: string;
  planned: string;
  actual: string;
  pct: number | null;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 'var(--sp-3)',
        padding: 'var(--sp-2) 0',
        borderBottom: '1px solid var(--border)',
        fontSize: 14,
      }}
    >
      <span style={{ color: 'var(--text-dim)', minWidth: 80 }}>{label}</span>
      <span style={{ color: 'var(--text)', textAlign: 'right', flex: 1 }}>
        {planned} <span style={{ color: 'var(--text-dim)' }}>→</span> {actual}
        {pct !== null && (
          <span style={{ color: 'var(--text-dim)', marginLeft: 'var(--sp-2)' }}>
            ({pct}%)
          </span>
        )}
      </span>
    </div>
  );
}

interface ActivityPickerProps {
  onPick: (activityId: string | number) => void;
  pairing: boolean;
}

function ActivityPicker({ onPick, pairing }: ActivityPickerProps) {
  const today = new Date();
  const past = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const oldest = past.toISOString().slice(0, 10);
  const newest = today.toISOString().slice(0, 10);

  const { data, isLoading, isError } = useQuery<Activity[]>({
    queryKey: ['recent-activities', oldest, newest],
    queryFn: () => getActivities({ oldest, newest, limit: 20 }),
    retry: 1,
  });

  if (isLoading) {
    return <SkeletonBar height={44} />;
  }
  if (isError) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
        Could not load recent activities.
      </p>
    );
  }
  const activities = data ?? [];
  if (activities.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
        No linkable activities found.
      </p>
    );
  }

  return (
    <div
      data-testid="activity-picker"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}
    >
      {activities.map((a) => (
        <button
          key={String(a.id)}
          data-testid="activity-option"
          disabled={pairing}
          onClick={() => onPick(a.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 2,
            minHeight: 44,
            textAlign: 'left',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            padding: 'var(--sp-2) var(--sp-3)',
            cursor: pairing ? 'default' : 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          <span style={{ fontSize: 14 }}>{a.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            {formatDate(a.start_date_local)}
            {a.icu_training_load != null && ` · ${a.icu_training_load} TSS`}
          </span>
        </button>
      ))}
    </div>
  );
}

interface ComplianceSectionProps {
  eventId: string | number;
  onChanged: () => void;
}

function ComplianceSection({ eventId, onChanged }: ComplianceSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: compliance,
    isLoading,
    isError,
  } = useQuery<Compliance>({
    queryKey: ['compliance', eventId],
    queryFn: () => getCompliance(eventId),
    retry: 0,
  });

  async function handlePair(activityId: string | number) {
    setMutating(true);
    setActionError(null);
    try {
      await pairActivity(eventId, activityId);
      setPickerOpen(false);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not link activity.');
    } finally {
      setMutating(false);
    }
  }

  async function handleUnlink() {
    setMutating(true);
    setActionError(null);
    try {
      await unpairActivity(eventId);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not unlink activity.');
    } finally {
      setMutating(false);
    }
  }

  return (
    <div data-testid="compliance-section" style={{ margin: '0 var(--sp-4) var(--sp-4)' }}>
      <SectionHeading>Compliance</SectionHeading>
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          padding: 'var(--sp-3) var(--sp-4)',
        }}
      >
        {isLoading && <SkeletonBar height={48} />}

        {!isLoading && isError && (
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
            Compliance data unavailable.
          </p>
        )}

        {!isLoading && !isError && compliance && (
          <>
            {compliance.paired && compliance.actual ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                  <span
                    data-testid="verdict-badge"
                    style={{
                      background: VERDICT_META[compliance.compliance.verdict].color,
                      color: '#0a0e14',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {VERDICT_META[compliance.compliance.verdict].label}
                  </span>
                  {compliance.compliance.load_pct !== null && (
                    <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                      {compliance.compliance.load_pct}% of planned
                    </span>
                  )}
                </div>

                <ComplianceRow
                  label="Load (TSS)"
                  planned={compliance.planned.load != null ? String(compliance.planned.load) : '—'}
                  actual={compliance.actual.load != null ? String(compliance.actual.load) : '—'}
                  pct={compliance.compliance.load_pct}
                />
                <ComplianceRow
                  label="Duration"
                  planned={
                    compliance.planned.duration != null
                      ? formatDuration(compliance.planned.duration)
                      : '—'
                  }
                  actual={
                    compliance.actual.duration != null
                      ? formatDuration(compliance.actual.duration)
                      : '—'
                  }
                  pct={compliance.compliance.duration_pct}
                />

                <button
                  data-testid="unlink-btn"
                  onClick={handleUnlink}
                  disabled={mutating}
                  style={{
                    alignSelf: 'flex-start',
                    minHeight: 44,
                    marginTop: 'var(--sp-1)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: 13,
                    cursor: mutating ? 'default' : 'pointer',
                    fontFamily: 'var(--font)',
                    padding: 'var(--sp-2) 0',
                  }}
                >
                  {mutating ? 'Working…' : 'Unlink'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: 0 }}>
                  {compliance.paired
                    ? 'Linked activity is unavailable.'
                    : 'Not linked to an activity yet.'}
                </p>
                {!pickerOpen && !compliance.paired && (
                  <button
                    data-testid="link-activity-btn"
                    onClick={() => setPickerOpen(true)}
                    style={{
                      alignSelf: 'flex-start',
                      minHeight: 44,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      color: 'var(--text)',
                      fontSize: 14,
                      padding: 'var(--sp-2) var(--sp-4)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    Link activity…
                  </button>
                )}
                {compliance.paired && (
                  <button
                    data-testid="unlink-btn"
                    onClick={handleUnlink}
                    disabled={mutating}
                    style={{
                      alignSelf: 'flex-start',
                      minHeight: 44,
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      fontSize: 13,
                      cursor: mutating ? 'default' : 'pointer',
                      fontFamily: 'var(--font)',
                      padding: 'var(--sp-2) 0',
                    }}
                  >
                    {mutating ? 'Working…' : 'Unlink'}
                  </button>
                )}
                {pickerOpen && (
                  <ActivityPicker onPick={handlePair} pairing={mutating} />
                )}
              </div>
            )}

            {actionError && (
              <p style={{ fontSize: 13, color: '#e84040', margin: 'var(--sp-2) 0 0' }}>
                {actionError}
              </p>
            )}
          </>
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

  // Fetch intervals (for completed activities only).
  // Activity ids from intervals.icu start with "i" (e.g. "i159692282").
  // For numeric planned-event ids, skip — the endpoint returns 404 and
  // retrying it generates spurious console errors.
  const isActivityId = !!id && (id.startsWith('i') || eventFailed);
  const {
    data: intervals,
  } = useQuery<ActivityIntervals>({
    queryKey: ['activity-intervals', id],
    queryFn: () => getActivityIntervals(id!),
    enabled: isActivityId,
    retry: 0,
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

  // Invalidate event + compliance after pair/unpair
  const invalidateCompliance = () => {
    queryClient.invalidateQueries({ queryKey: ['compliance', id] });
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

          {/* Compliance — planned vs. actual, for planned workouts */}
          {event.category === 'WORKOUT' && (
            <ComplianceSection eventId={id!} onChanged={invalidateCompliance} />
          )}

          {/* Description */}
          {event.description && <Description text={event.description} />}
        </>
      )}
    </AppShell>
  );
}
