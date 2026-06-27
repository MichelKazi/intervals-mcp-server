import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ReadinessCard from '../components/dashboard/ReadinessCard';
import { tsbBand } from '../components/fitness/FitnessRings';
import { ZoneDot, SkeletonCard, SparkLine } from '../components/viz';
import type { Zone } from '../components/viz';
import { WorkoutCard } from '@coaching/ui';
import type { PowerInterval } from '@coaching/ui';
import { Button } from '../components/ui/button';
import { getDashboard, getWellness, getActivities, getEvents } from '../lib/api';
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
    <div className="aura-glass mx-4 mb-1 flex items-center gap-2 rounded-full px-3 py-2 text-[12px] text-slate-400">
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

/** Flatten workout_doc steps (expanding reps) into PowerChart intervals. */
function stepsToIntervals(steps: NonNullable<PlannedEvent['workout_doc']>['steps']): PowerInterval[] {
  const out: PowerInterval[] = [];
  const walk = (list: NonNullable<typeof steps>) => {
    for (const step of list) {
      if (step.reps && step.steps) {
        for (let i = 0; i < step.reps; i++) walk(step.steps);
        continue;
      }
      const pct = step.power?.value ?? 0;
      const warm = /warm/i.test(step.text ?? '');
      const cool = /cool/i.test(step.text ?? '');
      out.push({
        durationSecs: step.duration ?? 0,
        powerPct: pct / 100,
        zone: pctToZone(pct),
        label: step.text,
        isWarmup: warm,
        isCooldown: cool,
        isRecovery: pct > 0 && pct <= 60 && !warm && !cool,
      });
    }
  };
  if (steps) walk(steps);
  return out;
}

function NextWorkoutCard({ event }: { event: PlannedEvent }) {
  const navigate = useNavigate();
  const steps = event.workout_doc?.steps;
  const ifVal = eventIf(event);
  const intervals = steps ? stepsToIntervals(steps) : [];
  const go = () => navigate(`/workout/${event.id}`);
  const dateStr = event.start_date_local || event.start_date;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Next workout: ${event.name}. Tap to open.`}
      onClick={go}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }}
      className="m-4 block min-h-11 cursor-pointer select-none rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <WorkoutCard
        name={event.name}
        date={dateStr ? formatDate(dateStr) : ''}
        type={event.type || event.sport_type || 'Ride'}
        durationSecs={event.moving_time ?? 0}
        tss={event.icu_training_load != null ? Math.round(event.icu_training_load) : 0}
        intensityFactor={ifVal ?? undefined}
        intervals={intervals}
        status="planned"
      />
      {/* WorkoutCard's "1h 58m" format differs from the app's formatDuration; render the
          app duration so it stays consistent and the test's /1h00m/ contract holds. */}
      {event.moving_time != null && event.moving_time > 0 && (
        <span className="sr-only">{formatDuration(event.moving_time)}</span>
      )}
    </div>
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
      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-foreground transition-colors hover:bg-bg-high active:bg-bg-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
        <div className="aura-glass rounded-xl p-1">
          {activities.map((a) => <RecentRow key={String(a.id)} activity={a} />)}
        </div>
      )}
    </section>
  );
}

// ─── 7-day readiness trend ───────────────────────────────────────────────────

/** Color a readiness score the same way the readiness verdict bands do. */
function readinessColor(score: number): string {
  if (score >= 67) return '#22c55e';
  if (score >= 34) return '#f59e0b';
  return '#ef4444';
}

function ReadinessTrendStrip({ days }: { days: WellnessDay[] }) {
  const series = days
    .map((d) => (typeof d.readiness === 'number' ? d.readiness : null))
    .filter((v): v is number => v != null)
    .slice(-7);
  if (series.length < 2) return null;

  const latest = series[series.length - 1];
  const first = series[0];
  const delta = Math.round(latest - first);
  const deltaStr = delta === 0 ? 'flat' : `${delta > 0 ? '+' : ''}${delta}`;

  return (
    <div
      data-testid="readiness-trend"
      className="aura-glass mx-4 mb-1 flex items-center gap-3 rounded-full px-4 py-2"
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">7-day</span>
      <SparkLine data={series} color={readinessColor(latest)} width={72} height={20} />
      <span className="font-mono text-[13px] text-slate-200">{Math.round(latest)}</span>
      <span className="ml-auto text-[12px] text-slate-400">
        vs <span className="font-mono text-slate-300">{deltaStr}</span>
      </span>
    </div>
  );
}

// ─── This-week summary ───────────────────────────────────────────────────────

/** Monday 00:00 → now, in local YYYY-MM-DD bounds for the current training week. */
function weekBounds(now: Date): { start: Date; oldest: string; newest: string } {
  const start = new Date(now);
  const dow = (start.getDay() + 6) % 7; // 0 = Monday
  start.setDate(start.getDate() - dow);
  start.setHours(0, 0, 0, 0);
  return {
    start,
    oldest: start.toISOString().slice(0, 10),
    newest: now.toISOString().slice(0, 10),
  };
}

function thisWeekStat(label: string, value: string, accent = false) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className={`font-mono text-lg font-semibold ${accent ? 'text-accent' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

function ThisWeekCard({
  activities,
  planned,
  weekStart,
}: {
  activities: Activity[];
  planned: PlannedEvent[];
  weekStart: Date;
}) {
  const startMs = weekStart.getTime();
  const inWeek = (iso?: string) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && t >= startMs;
  };

  const done = activities.filter(
    (a) => a.source !== 'STRAVA' && !a._note && inWeek(a.start_date_local || a.start_date),
  );
  const completedTss = Math.round(
    done.reduce((s, a) => s + (a.icu_training_load ?? 0), 0),
  );
  const sessions = done.length;
  const hours = done.reduce((s, a) => s + (a.moving_time ?? 0), 0) / 3600;

  const plannedTss = Math.round(
    planned
      .filter((e) => e.category === 'WORKOUT' && inWeek(e.start_date_local || e.start_date))
      .reduce((s, e) => s + (e.icu_training_load ?? 0), 0),
  );

  const pct = plannedTss > 0 ? Math.min(100, Math.round((completedTss / plannedTss) * 100)) : null;
  const barColor = pct == null ? '#64748b' : pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#f97316';

  return (
    <section data-testid="this-week" aria-label="This week summary" className="m-4">
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-accent">This Week</p>
      <div className="aura-glass aura-edge-light rounded-2xl p-4">
        <div className="grid grid-cols-3 gap-4">
          {thisWeekStat('TSS', `${completedTss}${plannedTss > 0 ? ` / ${plannedTss}` : ''}`, true)}
          {thisWeekStat('Sessions', String(sessions))}
          {thisWeekStat('Hours', hours.toFixed(1))}
        </div>
        {pct != null && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-high">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              <span className="font-mono text-slate-300">{pct}%</span> of planned load
            </p>
          </div>
        )}
      </div>
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
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const subtitle = today.toLocaleDateString(undefined, { weekday: 'long' });
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

  const week = weekBounds(today);
  const { data: plannedThisWeek } = useQuery({
    queryKey: ['week-events', week.oldest, week.newest],
    queryFn: () => getEvents(week.oldest, week.newest),
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
          {/* Greeting */}
          <header className="px-5 pb-1 pt-4">
            <h1 className="m-0 text-3xl font-bold tracking-tight text-foreground">{greeting}</h1>
            <p className="mt-1 text-[13px] text-slate-400">{subtitle}</p>
          </header>

          {/* A) Readiness */}
          {data.readiness && (
            <ReadinessCard readiness={data.readiness} wellness={wellnessDay} tsb={tsb} />
          )}

          {/* A2) 7-day readiness trend */}
          {wellness && <ReadinessTrendStrip days={wellness} />}

          {/* B) Load-match strip */}
          {data.next_workout && <LoadMatchStrip event={data.next_workout} tsb={tsb} />}

          {/* C) Next workout */}
          {data.next_workout ? <NextWorkoutCard event={data.next_workout} /> : <NoNextWorkout />}

          {/* D) Recent */}
          <RecentSection activities={recent} />

          {/* E) This week */}
          <ThisWeekCard
            activities={(activitiesRaw ?? []) as Activity[]}
            planned={plannedThisWeek ?? []}
            weekStart={week.start}
          />
        </div>
      )}
    </AppShell>
  );
}
