import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import Skeleton from '../components/Skeleton';
import ReadinessBadge from '../components/dashboard/ReadinessBadge';
import WorkoutChart from '../components/WorkoutChart';
import FitnessRings from '../components/fitness/FitnessRings';
import FitnessTrend from '../components/fitness/FitnessTrend';
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
      style={{
        margin: 'var(--sp-4)',
        padding: 'var(--sp-4)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-2)',
        cursor: 'pointer',
        outline: 'none',
        userSelect: 'none',
      }}
      onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--accent)'; }}
      onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-2)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 var(--sp-1)', fontSize: 11, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Next Workout
          </p>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event.name}
          </h2>
        </div>
        <svg
          width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="var(--text-dim)" strokeWidth="2"
          aria-hidden="true"
          style={{ flexShrink: 0, marginLeft: 'var(--sp-2)', marginTop: 2 }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', marginBottom: steps ? 'var(--sp-4)' : 0 }}>
        {(event.start_date_local || event.start_date) && (
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{formatDate(event.start_date_local || event.start_date!)}</span>
        )}
        {(event.type || event.sport_type) && (
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{event.type || event.sport_type}</span>
        )}
        {event.moving_time != null && event.moving_time > 0 && (
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {formatDuration(event.moving_time)}
          </span>
        )}
        {event.icu_training_load != null && (
          <span
            style={{
              fontSize: 13,
              color: 'var(--accent)',
              fontWeight: 600,
              background: 'rgba(240,165,0,0.12)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {Math.round(event.icu_training_load)} TSS
          </span>
        )}
      </div>

      {/* Workout chart preview */}
      {steps && steps.length > 0 && (
        <div
          style={{ pointerEvents: 'none', opacity: 0.9 }}
          aria-hidden="true"
        >
          <WorkoutChart steps={steps} ftp={ftp} />
        </div>
      )}
    </article>
  );
}

// ─── Empty state for next workout ────────────────────────────────────────────

function NoNextWorkout() {
  return (
    <div
      style={{
        margin: 'var(--sp-4)',
        padding: 'var(--sp-6)',
        background: 'var(--surface)',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        textAlign: 'center',
      }}
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 15 }}>No upcoming workout</p>
      <Link
        to="/library"
        style={{
          color: 'var(--accent)',
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 600,
          padding: 'var(--sp-2) var(--sp-4)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius)',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        Browse library
      </Link>
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
      style={{
        margin: 'var(--sp-4)',
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        minHeight: 44,
        outline: 'none',
      }}
      onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--accent)'; }}
      onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Last Activity
        </p>
        <p style={{ margin: '0 0 var(--sp-1)', fontSize: 15, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activity.name}
        </p>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          {(activity.type || activity.sport_type) && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{activity.type || activity.sport_type}</span>
          )}
          {activity.moving_time != null && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{formatDuration(activity.moving_time)}</span>
          )}
          {activity.distance != null && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{formatDistance(activity.distance)}</span>
          )}
          {activity.icu_training_load != null && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{Math.round(activity.icu_training_load)} TSS</span>
          )}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}>
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
      <div
        style={{
          margin: 'var(--sp-4)',
          padding: 'var(--sp-4)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
        aria-busy="true"
      >
        <Skeleton width="30%" height={11} style={{ marginBottom: 'var(--sp-3)' }} />
        <div style={{ display: 'flex', gap: 'var(--sp-4)', justifyContent: 'center' }}>
          <Skeleton width={80} height={80} style={{ borderRadius: '50%' }} />
          <Skeleton width={80} height={80} style={{ borderRadius: '50%' }} />
          <Skeleton width={80} height={80} style={{ borderRadius: '50%' }} />
        </div>
      </div>
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
      style={{
        margin: 'var(--sp-4)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        paddingTop: 'var(--sp-3)',
        paddingBottom: 'var(--sp-4)',
      }}
    >
      <p
        style={{
          margin: '0 0 var(--sp-1) var(--sp-4)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--accent)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Fitness
      </p>
      <FitnessRings fitness={fitness} fatigue={fatigue} form={form} />
      <div style={{ padding: '0 var(--sp-4) var(--sp-2)' }}>
        <FitnessTrend series={data} />
      </div>
    </section>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" style={{ padding: 'var(--sp-4)' }}>
      {/* Hero card skeleton */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
        <Skeleton width="40%" height={11} style={{ marginBottom: 'var(--sp-2)' }} />
        <Skeleton width="70%" height={24} style={{ marginBottom: 'var(--sp-3)' }} />
        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
          <Skeleton width={80} height={16} />
          <Skeleton width={60} height={16} />
          <Skeleton width={50} height={16} />
        </div>
        <Skeleton width="100%" height={100} />
      </div>
      {/* Readiness skeleton */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', gap: 'var(--sp-3)' }}>
        <Skeleton width={70} height={24} />
        <Skeleton width="60%" height={24} />
      </div>
      {/* Latest activity skeleton */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--sp-3) var(--sp-4)' }}>
        <Skeleton width="50%" height={15} style={{ marginBottom: 'var(--sp-2)' }} />
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
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
        <div
          style={{
            margin: 'var(--sp-4)',
            padding: 'var(--sp-6)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--sp-4)' }}>
            {error instanceof Error ? error.message : 'Could not load dashboard. Check your connection.'}
          </p>
          <button
            onClick={() => refetch()}
            style={{
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius)',
              padding: 'var(--sp-2) var(--sp-4)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              minHeight: 44,
              minWidth: 80,
            }}
          >
            Retry
          </button>
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
