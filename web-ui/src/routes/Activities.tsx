import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import SportIcon, { sportColor } from '../components/calendar/SportIcon';
import { getActivities } from '../lib/api';
import { formatDate, formatDuration, formatDistance } from '../lib/format';
import type { Activity } from '../lib/types';

function toISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function Activities() {
  const navigate = useNavigate();

  const today = new Date();
  const oldest = toISO(new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000));
  const newest = toISO(today);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['activities', oldest, newest],
    queryFn: () => getActivities({ oldest, newest, limit: 50, include_unnamed: 1 }),
  });

  const activities: Activity[] = (data ?? []).filter(
    (a: Activity) => a.source !== 'STRAVA' && !a._note && !!a.name,
  );

  if (isLoading) {
    return (
      <AppShell title="Activities">
        <div className="flex flex-col gap-3 px-4 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-16 rounded-lg bg-muted" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title="Activities">
        <div className="px-4 pt-4">
          <p className="text-destructive mb-2">
            {error instanceof Error ? error.message : 'Failed to load activities'}
          </p>
          <button
            onClick={() => refetch()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </AppShell>
    );
  }

  if (!activities.length) {
    return (
      <AppShell title="Activities">
        <div className="px-4 pt-4">
          <p className="text-muted-foreground">No activities yet</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Activities">
      <ul className="flex flex-col gap-1 px-4 pt-4">
        {activities.map((activity) => {
          const dateStr = activity.start_date_local ?? activity.start_date;
          const color = sportColor(activity.type ?? activity.sport_type ?? '');

          return (
            <li key={activity.id}>
              <button
                onClick={() => navigate(`/workout/${activity.id}`)}
                className="flex w-full items-center gap-3 rounded-lg bg-card px-4 py-3 text-left text-foreground transition-colors hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <SportIcon
                  type={activity.type ?? activity.sport_type ?? ''}
                  color={color}
                  size={20}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-snug">{activity.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {dateStr ? formatDate(dateStr) : ''}
                    {activity.moving_time != null && (
                      <span className="before:mx-1 before:content-['·']">
                        {formatDuration(activity.moving_time)}
                      </span>
                    )}
                    {formatDistance(activity.distance) && (
                      <span className="before:mx-1 before:content-['·']">
                        {formatDistance(activity.distance)}
                      </span>
                    )}
                    {activity.icu_training_load != null && (
                      <span className="before:mx-1 before:content-['·']">
                        {Math.round(activity.icu_training_load)} TSS
                      </span>
                    )}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
