import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ReadinessCard from '../components/dashboard/ReadinessCard';
import WorkoutChart from '../components/WorkoutChart';
import { tsbBand } from '../components/fitness/FitnessRings';
import { AdaptiveBadge, ZoneDot, SkeletonCard } from '../components/viz';
import type { Zone } from '../components/viz';
import { Button } from '../components/ui/button';
import { getDashboard, getWellness, getActivities } from '../lib/api';
import { formatDate, formatDuration, DEFAULT_FTP } from '../lib/format';
import type { PlannedEvent, Activity, WellnessDay } from '../lib/types';

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Latest wellness day that has CTL/ATL filled in. */
function latestFitnessDay(days?: WellnessDay[]): WellnessDay | null {
  if (!days?.length) return null;
  return [...days].reverse().find((d) => d.ctl != null && d.atl != null) ?? null;
}

/** Most recent wellness day with any subjective metrics. */
function latestWellnessDay(days?: WellnessDay[]): WellnessDay | null {
  if (!days?.length) return days?.[days.length - 1] ?? null;
  return [...days].reverse().find((d) => d.hrv != null || d.restingHR != null || d.sleepScore != null)
    ?? days[days.length - 1];
}

/** Intensity Factor from an event: explicit, or derived from TSS + duration. */
function eventIf(event: PlannedEvent): number | null {
  if (typeof event.icu_intensity === 'number' && event.icu_intensity > 0) {
    return event.icu_intensity > 3 ? event.icu_intensity / 100 : event.icu_intensity;
  }
  const tss = event.icu_training_load;
  const secs = event.moving_time;
  if (tss && secs && secs > 0) {
    return Math.sqrt((tss * 3600) / (secs * 100));
  }
  return null;
}

/** Map a power %FTP to a 1–5 zone for ZoneDot. */
function pctToZone(pct: number): Zone {
  if (pct <= 75) return 1;
  if (pct <= 90) return 2;
  if (pct <= 105) return 3;
  if (pct <= 120) return 4;
  return 5;
}

/** Approximate average %FTP for an activity for its zone dot. */
function activityZone(a: Activity): Zone {
  const ftp = (a.icu_ftp as number) ?? DEFAULT_FTP;
  const watts = (a.icu_weighted_avg_watts as number) ?? (a.icu_average_watts as number);
  if (watts && ftp) return pctToZone((watts / ftp) * 100);
  return 1;
}

// ─── B) Load-match strip ─────────────────────────────────────────────────────

function LoadMatchStrip({ event, tsb }: { event: PlannedEvent; tsb: number | null }) {
  const planned = event.icu_training_load != null ? Math.round(event.icu_training_load) : null;
  const ifVal = eventIf(event);
  const band = tsb != null ? tsbBand(tsb) : null;
  const tsbStr = tsb != null ? `${tsb > 0 ? '+' : ''}${Math.round(tsb)}` : '—';

  // Timing verdict: fresh + hard day = good, deep fatigue + hard day = wrong day.
  let pill = { label: 'OK timing', cls: 'text-status-green bg-status-green/15' };
  const hard = ifVal != null && ifVal >= 0.9;
  if (tsb != null && hard && tsb <= -25) pill = { label: 'Wrong day', cls: 'text-status-red bg-status-red/15' };
  else if (tsb != null && hard && tsb <= -10) pill = { label: 'Risky', cls: 'text-status-yellow bg-status-yellow/15' };

  return (
    <div className="mx-4 mb-1 flex items-center gap-2 rounded-full bg-bg-raised/50 px-3 py-2 text-[12px] text-slate-400">
      <span>
        Today: <span className="font-mono text-slate-200">{planned != null ? planned : '—'}</span> TSS planned
      </span>
      <span className="text-slate-600">·</span>
      <span>
        Form: {band ? band.label : '—'} <span className="font-mono text-slate-200">{tsbStr}</span>
      </span>
      <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.cls}`}>
        {pill.label}
      </span>
    </div>
  );
}

// ─── C) Next workout card ────────────────────────────────────────────────────

function NextWorkoutCard({ event }: { event: PlannedEvent }) {
  const navigate = useNavigate();
  const steps = event.workout_doc?.steps;
  const ftp = (event.icu_ftp as number) ?? DEFAULT_FTP;
  const ifVal = eventIf(event);
  const go = () => navigate(`/workout/${event.id}`);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Next workout: ${event.name}. Tap to open.`}
      onClick={go}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}
      className="m-4 block min-h-11 cursor-pointer select-none rounded-2xl border border-border-default bg-bg-surface p-4 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-accent">
        Next Workout
      </p>
      <h2 className="m-0 truncate text-xl font-semibold leading-tight text-foreground">
        {event.name}
      </h2>

      <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 ${steps?.length ? 'mb-4' : ''}`}>
        {(event.start_date_local || event.start_date) && (
          <span className="text-[13px] text-slate-400">{formatDate(event.start_date_local || event.start_date!)}</span>
        )}
        {(event.type || event.sport_type) && (
          <span className="text-[13px] text-slate-400">{event.type || event.sport_type}</span>
        )}
        {event.moving_time != null && event.moving_time > 0 && (
          <span className="text-[13px] text-slate-400">{formatDuration(event.moving_time)}</span>
        )}
        {event.icu_training_load != null && (
          <span className="rounded-sm bg-accent/10 px-1.5 py-px text-[13px] font-semibold text-accent">
            <span className="font-mono">{Math.round(event.icu_training_load)}</span> TSS
          </span>
        )}
        {ifVal != null && <AdaptiveBadge ifValue={ifVal} />}
      </div>

      {steps && steps.length > 0 && (
        <div className="pointer-events-none" aria-hidden="true">
          <WorkoutChart steps={steps} ftp={ftp} />
        </div>
      )}
    </article>
  );
}

function NoNextWorkout() {
  return (
    <div className="m-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border-default bg-bg-surface p-6 text-center">
      <p className="m-0 text-[15px] font-medium text-foreground">Rest day.</p>
      <p className="m-0 text-[13px] text-slate-400">Recovery is training.</p>
      <Button asChild variant="outline" size="touch" className="mt-2 border-accent text-accent">
        <Link to="/library">Browse library</Link>
      </Button>
    </div>
  );
}

// ─── D) Recent activities ────────────────────────────────────────────────────

function RecentRow({ activity }: { activity: Activity }) {
  const navigate = useNavigate();
  const go = () => navigate(`/workout/${activity.id}`);
  return (
    <button
      type="button"
      aria-label={`Activity: ${activity.name}. Tap to open.`}
      onClick={go}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-bg-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <ZoneDot zone={activityZone(activity)} />
      <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{activity.name}</span>
      {activity.moving_time != null && (
        <span className="shrink-0 text-[12px] text-slate-400">{formatDuration(activity.moving_time)}</span>
      )}
      {activity.icu_training_load != null && (
        <span className="shrink-0 font-mono text-[12px] text-slate-300">{Math.round(activity.icu_training_load)}</span>
      )}
    </button>
  );
}

function RecentSection({ activities }: { activities: Activity[] }) {
  return (
    <section aria-label="Recent activities" className="m-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">Recent</p>
        <Link to="/calendar" className="text-[12px] text-slate-400 hover:text-foreground">View all →</Link>
      </div>
      {activities.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-bg-surface px-4 py-5 text-center text-[13px] text-slate-400">
          Nothing logged yet. Ride something.
        </p>
      ) : (
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-1">
          {activities.map((a) => <RecentRow key={String(a.id)} activity={a} />)}
        </div>
      )}
    </section>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="flex flex-col gap-4 p-4">
      <SkeletonCard rows={3} className="rounded-2xl" />
      <SkeletonCard rows={4} className="rounded-2xl" />
      <SkeletonCard rows={3} />
    </div>
  );
}

// ─── Dashboard screen ────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  const today = new Date();
  const newest = today.toISOString().slice(0, 10);
  const past = new Date(today);
  past.setDate(past.getDate() - 42);
  const oldest = past.toISOString().slice(0, 10);

  const { data: wellness } = useQuery({
    queryKey: ['wellness', oldest, newest],
    queryFn: () => getWellness(oldest, newest),
  });

  const actPast = new Date(today);
  actPast.setDate(actPast.getDate() - 14);
  const actOldest = actPast.toISOString().slice(0, 10);

  const { data: activitiesRaw } = useQuery({
    queryKey: ['recent-activities', actOldest, newest],
    queryFn: () => getActivities({ oldest: actOldest, newest, limit: 30 }),
  });

  const fitnessDay = latestFitnessDay(wellness);
  const tsb = fitnessDay && fitnessDay.ctl != null && fitnessDay.atl != null
    ? fitnessDay.ctl - fitnessDay.atl
    : null;
  const wellnessDay = latestWellnessDay(wellness);

  const recent: Activity[] = (activitiesRaw ?? [])
    .filter((a) => (a as Activity).source !== 'STRAVA' && !(a as Activity)._note && !!a.name)
    .slice(0, 3);

  return (
    <AppShell title="Home">
      {isLoading && <DashboardSkeleton />}

      {isError && (
        <div className="m-4 rounded-lg border border-border-default bg-bg-surface p-6 text-center">
          <p className="mb-4 text-slate-400">
            {error instanceof Error ? error.message : 'Could not load dashboard. Check your connection.'}
          </p>
          <Button onClick={() => refetch()} size="touch" className="min-w-[80px]">Retry</Button>
        </div>
      )}

      {!isLoading && !isError && data && (
        <div className="pb-20">
          {/* A) Readiness */}
          {data.readiness && (
            <ReadinessCard readiness={data.readiness} wellness={wellnessDay} tsb={tsb} />
          )}

          {/* B) Load-match strip */}
          {data.next_workout && <LoadMatchStrip event={data.next_workout} tsb={tsb} />}

          {/* C) Next workout */}
          {data.next_workout ? <NextWorkoutCard event={data.next_workout} /> : <NoNextWorkout />}

          {/* D) Recent */}
          <RecentSection activities={recent} />
        </div>
      )}
    </AppShell>
  );
}
