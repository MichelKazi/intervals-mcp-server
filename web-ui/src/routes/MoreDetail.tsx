import { useParams } from 'react-router-dom';
import type { ComponentType } from 'react';

import AppShell from '@/components/AppShell';
import Sleep from './more/Sleep';
import ReadinessHistory from './more/ReadinessHistory';
import BodyMetrics from './more/BodyMetrics';
import RaceHub from './more/RaceHub';
import RaceReadiness from './more/RaceReadiness';

// slug → screen component. Parallel agents add their own entries here.
const SCREENS: Record<string, ComponentType> = {
  // Wellness + Race group
  'sleep': Sleep,
  'readiness-history': ReadinessHistory,
  'body-metrics': BodyMetrics,
  'race-hub': RaceHub,
  'race-readiness': RaceReadiness,
};

function titleFromSlug(slug?: string): string {
  if (!slug) return 'Coming Soon';
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Routes /more/<slug> to a built screen, or a placeholder until one exists. */
export default function MoreDetail() {
  const { slug } = useParams<{ slug: string }>();
  const Screen = slug ? SCREENS[slug] : undefined;
  if (Screen) return <Screen />;

  return (
    <AppShell title={titleFromSlug(slug)} showBack>
      <div className="flex flex-col items-center justify-center gap-2 px-6 pb-20 pt-24 text-center">
        <p className="text-base font-semibold text-slate-100">Coming soon</p>
        <p className="text-[13px] text-slate-400">This screen is under construction.</p>
      </div>
    </AppShell>
  );
}
