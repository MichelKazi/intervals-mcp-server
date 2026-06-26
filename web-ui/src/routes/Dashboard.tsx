import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Skeleton from '../components/Skeleton';
import ReadinessBadge from '../components/dashboard/ReadinessBadge';
import WorkoutChart from '../components/WorkoutChart';
import FitnessRings from '../components/fitness/FitnessRings';
import FitnessTrend from '../components/fitness/FitnessTrend';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { getDashboard, getWellness } from '../lib/api';
import { formatDate, formatDuration, formatDistance, DEFAULT_FTP } from '../lib/format';
import type { PlannedEvent, Activity } from '../lib/types';

// ─── Next workout hero ─────────────────────────────────────────────────────

interface NextWorkoutCardProps {
  event: PlannedEvent;
}

function NextWorkoutCard({ event }: NextWorkoutCardProps) {
  const navigate = useNavigate();
  const steps = event.workout_doc?.steps;
  const ftp = event.icu_ftp ?? DEFAULT_FTP;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Next workout: ${event.name}. Tap to open.`}
      onClick={() => navigate(`/workout/${event.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/workout/${event.id}`);
        }
      }}
      className="m-4 block cursor-pointer select-none rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Header row */}
        <div className="mb-2 flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
              Next Workout
            </p>
            <h2 className="m-0 truncate text-xl font-bold leading-tight text-foreground">
              {event.name}
            </h2>
          </div>
          <svg
            width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="var(--text-dim)" strokeWidth="2"
            aria-hidden="true"
            className="ml-2 mt-0.5 shrink-0"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>

        {/* Meta row */}
        <div className={`flex flex-wrap gap-3 ${steps ? 'mb-4' : ''}`}>
          {(event.start_date_local || event.start_date) && (
            <span className="text-[13px] text-muted-foreground">{formatDate(event.start_date_local || event.start_date!)}</span>
          )}
          {(event.type || event.sport_type) && (
            <span className="text-[13px] text-muted-foreground">{event.type || event.sport_type}</span>
          )}
          {event.moving_time != null && event.moving_time > 0 && (
            <span className="text-[13px] text-muted-foreground">
              {formatDuration(event.moving_time)}
            </span>
          )}
          {event.icu_training_load != null && (
            <span className="rounded-sm bg-primary/10 px-1.5 py-px text-[13px] font-semibold text-primary">
              {Math.round(event.icu_training_load)} TSS
            </span>
          )}
        </div>

      {/* Workout chart preview */}
      {steps && steps.length > 0 && (
        <div className="pointer-events-none opacity-90" aria-hidden="true">
          <WorkoutChart steps={steps} ftp={ftp} />
        </div>
      )}
    </article>
  );
}

// ─── Empty state for next workout ────────────────────────────────────────────

function NoNextWorkout() {
  return (
    <div className="m-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="m-0 text-[15px] text-muted-foreground">No upcoming workout</p>
      <Button asChild variant="outline" size="touch" className="border-primary text-primary">
        <Link to="/library">Browse library</Link>
      </Button>
    </div>
  );
}

// ─── Latest activity card ─────────────────────────────────────────────────

interface LatestActivityCardProps {
  activity: Activity;
}

function LatestActivityCard({ activity }: LatestActivityCardProps) {
  const navigate = useNavigate();

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Latest activity: ${activity.name}. Tap to open.`}
      onClick={() => navigate(`/workout/${activity.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/workout/${activity.id}`);
        }
      }}
      className="m-4 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            Last Activity
          </p>
          <p className="mb-1 truncate text-[15px] font-semibold text-foreground">
            {activity.name}
          </p>
          <div className="flex flex-wrap gap-3">
            {(activity.type || activity.sport_type) && (
              <span className="text-xs text-muted-foreground">{activity.type || activity.sport_type}</span>
            )}
            {activity.moving_time != null && (
              <span className="text-xs text-muted-foreground">{formatDuration(activity.moving_time)}</span>
            )}
            {activity.distance != null && (
              <span className="text-xs text-muted-foreground">{formatDistance(activity.distance)}</span>
            )}
            {activity.icu_training_load != null && (
              <span className="text-xs text-muted-foreground">{Math.round(activity.icu_training_load)} TSS</span>
            )}
          </div>
        </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" aria-hidden="true" className="shrink-0">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </article>
  );
}

// ─── Fitness section ──────────────────────────────────────────────────────

function FitnessSection() {
  // Compute date range: last 42 days
  const today = new Date();
  const newest = today.toISOString().slice(0, 10);
  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - 42);
  const oldest = pastDate.toISOString().slice(0, 10);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['wellness', oldest, newest],
    queryFn: () => getWellness(oldest, newest),
  });

  if (isLoading) {
    return (
      <Card className="m-4 rounded-2xl border-border bg-card p-4" aria-busy="true">
        <div className="mb-3"><Skeleton width="30%" height={11} /></div>
        <div className="flex justify-center gap-4">
          <Skeleton width={80} height={80} style={{ borderRadius: '50%' }} />
          <Skeleton width={80} height={80} style={{ borderRadius: '50%' }} />
          <Skeleton width={80} height={80} style={{ borderRadius: '50%' }} />
        </div>
      </Card>
    );
  }

  if (isError || !data || data.length === 0) {
    // Hide quietly on error or no data
    return null;
  }

  // Latest day with values
  const latest = [...data].reverse().find(d => d.ctl != null && d.atl != null);
  if (!latest) return null;

  const fitness = latest.ctl ?? 0;
  const fatigue = latest.atl ?? 0;
  const form = fitness - fatigue;

  return (
    <section
      aria-label="Fitness summary"
      className="m-4 rounded-2xl border border-border bg-card pb-4 pt-3"
    >
      <p className="mb-1 ml-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
        Fitness
      </p>
      <FitnessRings fitness={fitness} fatigue={fatigue} form={form} />
      <div className="px-4 pb-2">
        <FitnessTrend series={data} />
      </div>
    </section>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="p-4">
      {/* Hero card skeleton */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <div className="mb-2"><Skeleton width="40%" height={11} /></div>
        <div className="mb-3"><Skeleton width="70%" height={24} /></div>
        <div className="mb-4 flex gap-2">
          <Skeleton width={80} height={16} />
          <Skeleton width={60} height={16} />
          <Skeleton width={50} height={16} />
        </div>
        <Skeleton width="100%" height={100} />
      </div>
      {/* Readiness skeleton */}
      <div className="mb-4 flex gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <Skeleton width={70} height={24} />
        <Skeleton width="60%" height={24} />
      </div>
      {/* Latest activity skeleton */}
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="mb-2"><Skeleton width="50%" height={15} /></div>
        <div className="flex gap-2">
          <Skeleton width={60} height={12} />
          <Skeleton width={50} height={12} />
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard screen ─────────────────────────────────────────────────────

export default function Dashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  return (
    <AppShell title="Home">
      {isLoading && <DashboardSkeleton />}

      {isError && (
        <div className="m-4 rounded-lg border border-border bg-card p-6 text-center">
          <p className="mb-4 text-muted-foreground">
            {error instanceof Error ? error.message : 'Could not load dashboard. Check your connection.'}
          </p>
          <Button onClick={() => refetch()} size="touch" className="min-w-[80px]">
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          {data.next_workout
            ? <NextWorkoutCard event={data.next_workout} />
            : <NoNextWorkout />
          }

          {data.readiness && <ReadinessBadge readiness={data.readiness} />}

          <FitnessSection />

          {data.latest_activity && <LatestActivityCard activity={data.latest_activity} />}
        </>
      )}
    </AppShell>
  );
}
