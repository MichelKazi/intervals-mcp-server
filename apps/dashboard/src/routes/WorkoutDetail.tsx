import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AppShell from '../components/AppShell';
import WorkoutChart from '../components/WorkoutChart';
import MetricStrip from '../components/workout/MetricStrip';
import LapList from '../components/workout/LapList';
import ActionRow from '../components/workout/ActionRow';
import AlternativesSheet from '../components/workout/AlternativesSheet';
import Skeleton from '../components/Skeleton';
import { Eyebrow } from '@coaching/ui';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Chart placeholder */}
      <Skeleton height={220} />
      {/* Metric strip */}
      <div className="flex justify-around gap-4">
        <Skeleton width={60} height={36} />
        <Skeleton width={60} height={36} />
        <Skeleton width={60} height={36} />
      </div>
      {/* Action row */}
      <div className="flex gap-2">
        <Skeleton height={44} />
        <Skeleton height={44} />
      </div>
    </div>
  );
}

// ── Section heading (shared) ────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </h2>
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
    <form onSubmit={handleSave} className="mx-4 mb-4 flex flex-col gap-3 rounded-md bg-card p-4">
      <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Edit workout
      </h2>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Name</span>
        <Input
          data-testid="edit-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-[44px] text-[15px]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Date</span>
        <Input
          data-testid="edit-date-input"
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className="min-h-[44px] text-[15px] [color-scheme:dark]"
        />
      </label>

      {error && <div className="text-[13px]" style={{ color: 'var(--z5)' }}>{error}</div>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving} size="touch" className="flex-1">
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          onClick={onClose}
          variant="outline"
          size="touch"
          className="flex-1 bg-muted"
        >
          Cancel
        </Button>
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
    <div className="mx-4 mb-4">
      <SectionHeading>Description</SectionHeading>
      <div className="rounded-md bg-card px-4 py-3">
        <p className="m-0 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
          {isLong && !expanded ? text.slice(0, PREVIEW_LEN) + '…' : text}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="min-h-[44px] cursor-pointer border-none bg-transparent pt-2 text-[13px] text-primary"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Compliance ──────────────────────────────────────────────────────────────

const VERDICT_META: Record<ComplianceVerdict, { label: string; color: string; glow: string }> = {
  on_target: { label: 'On target', color: 'var(--z2)', glow: 'var(--glow-good)' },
  under: { label: 'Under', color: 'var(--z3)', glow: 'var(--glow-caution)' },
  over: { label: 'Over', color: 'var(--z1)', glow: 'var(--glow-danger)' },
  unknown: { label: 'Unknown', color: 'var(--text-dim)', glow: 'none' },
};

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
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm">
      <span className="min-w-[80px] text-muted-foreground">{label}</span>
      <span className="flex-1 text-right text-foreground">
        {planned} <span className="text-muted-foreground">→</span> {actual}
        {pct !== null && (
          <span className="ml-2 text-muted-foreground">({pct}%)</span>
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
    return <Skeleton height={44} />;
  }
  if (isError) {
    return (
      <p className="m-0 text-[13px] text-muted-foreground">
        Could not load recent activities.
      </p>
    );
  }
  const activities = data ?? [];
  if (activities.length === 0) {
    return (
      <p className="m-0 text-[13px] text-muted-foreground">
        No linkable activities found.
      </p>
    );
  }

  return (
    <div data-testid="activity-picker" className="flex flex-col gap-1">
      {activities.map((a) => (
        <button
          key={String(a.id)}
          data-testid="activity-option"
          disabled={pairing}
          onClick={() => onPick(a.id)}
          className="flex min-h-[44px] cursor-pointer flex-col items-start gap-0.5 rounded-md border border-border bg-muted px-3 py-2 text-left text-foreground transition-colors hover:border-primary hover:bg-accent/40 active:scale-[0.99] disabled:cursor-default disabled:opacity-60"
        >
          <span className="text-sm">{a.name}</span>
          <span className="text-xs text-muted-foreground">
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
    <div data-testid="compliance-section" className="mx-4 mb-4">
      <SectionHeading>Compliance</SectionHeading>
      <div className="rounded-md bg-card px-4 py-3">
        {isLoading && <Skeleton height={48} />}

        {!isLoading && isError && (
          <p className="m-0 text-[13px] text-muted-foreground">
            Compliance data unavailable.
          </p>
        )}

        {!isLoading && !isError && compliance && (
          <>
            {compliance.paired && compliance.actual ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span
                    data-testid="verdict-badge"
                    className="rounded-sm px-2.5 py-1 text-xs font-bold"
                    style={{
                      background: VERDICT_META[compliance.compliance.verdict].color,
                      color: 'var(--bg)',
                      boxShadow: VERDICT_META[compliance.compliance.verdict].glow,
                    }}
                  >
                    {VERDICT_META[compliance.compliance.verdict].label}
                  </span>
                  {compliance.compliance.load_pct !== null && (
                    <span className="text-[13px] text-muted-foreground">
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
                  className="mt-1 min-h-[44px] cursor-pointer self-start border-none bg-transparent py-2 text-[13px] text-primary transition-colors hover:text-foreground hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60"
                >
                  {mutating ? 'Working…' : 'Unlink'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="m-0 text-sm text-muted-foreground">
                  {compliance.paired
                    ? 'Linked activity is unavailable.'
                    : 'Not linked to an activity yet.'}
                </p>
                {!pickerOpen && !compliance.paired && (
                  <button
                    data-testid="link-activity-btn"
                    onClick={() => setPickerOpen(true)}
                    className="min-h-[44px] cursor-pointer self-start rounded-md border border-border bg-muted px-4 py-2 text-sm text-foreground transition-colors hover:border-primary hover:bg-accent/40 active:scale-[0.99]"
                  >
                    Link activity…
                  </button>
                )}
                {compliance.paired && (
                  <button
                    data-testid="unlink-btn"
                    onClick={handleUnlink}
                    disabled={mutating}
                    className="min-h-[44px] cursor-pointer self-start border-none bg-transparent py-2 text-[13px] text-primary transition-colors hover:text-foreground hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60"
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
              <p className="m-0 mt-2 text-[13px]" style={{ color: 'var(--z5)' }}>
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
        <div className="p-4 text-center text-muted-foreground">
          <p>Could not load workout.</p>
          <Button onClick={() => refetchEvent()} variant="outline" size="touch" className="bg-card">
            Retry
          </Button>
        </div>
      )}

      {!eventLoading && !eventError && !event && (
        <div className="p-4 text-muted-foreground">
          Workout details unavailable.
        </div>
      )}

      {!eventLoading && event && (
        <>
          {/* Eyebrow: status · date */}
          <div className="px-4 pt-3">
            <Eyebrow color="accent">
              {(hasLaps || event.category !== 'WORKOUT') ? 'COMPLETED' : 'PLANNED'}
              {event.start_date_local && (
                <>
                  {' · '}
                  {new Date(event.start_date_local)
                    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    .toUpperCase()}
                </>
              )}
            </Eyebrow>
          </div>

          {/* Chart hero — ~40vh, visually dominant */}
          <div data-testid="chart-container" className="px-4 pb-4 pt-4">
            {chartSteps || chartLaps ? (
              <WorkoutChart
                steps={chartSteps}
                laps={chartLaps}
                ftp={ftp}
              />
            ) : (
              <div className="flex h-[220px] items-center justify-center rounded-md bg-card text-[13px] text-muted-foreground">
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
              ftp={ftp}
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
