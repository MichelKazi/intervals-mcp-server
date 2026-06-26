import type { ComponentType } from 'react';
import { useParams } from 'react-router-dom';

import AppShell from '@/components/AppShell';
// Analytics
import Fitness from './more/Fitness';
import PowerProfile from './more/PowerProfile';
import Volume from './more/Volume';
import ZoneDistribution from './more/ZoneDistribution';
import Aerobic from './more/Aerobic';
import FatigueRisk from './more/FatigueRisk';
// Wellness + Race
import Sleep from './more/Sleep';
import ReadinessHistory from './more/ReadinessHistory';
import BodyMetrics from './more/BodyMetrics';
import RaceHub from './more/RaceHub';
import RaceReadiness from './more/RaceReadiness';
// Training + Tools
import PlannedVsActual from './more/PlannedVsActual';
import Polarization from './more/Polarization';
import WorkoutBuilder from './more/WorkoutBuilder';
import CoachingChat from './more/CoachingChat';
import DoseLog from './more/DoseLog';
import FieldTest from './more/FieldTest';
import Settings from './more/Settings';

// slug → screen component.
const SCREENS: Record<string, ComponentType> = {
  // Analytics
  'fitness': Fitness,
  'power-profile': PowerProfile,
  'volume': Volume,
  'zone-distribution': ZoneDistribution,
  'aerobic': Aerobic,
  'fatigue': FatigueRisk,
  // Wellness + Race
  'sleep': Sleep,
  'readiness-history': ReadinessHistory,
  'body-metrics': BodyMetrics,
  'race-hub': RaceHub,
  'race-readiness': RaceReadiness,
  // Training + Tools
  'planned-vs-actual': PlannedVsActual,
  'polarization': Polarization,
  'workout-builder': WorkoutBuilder,
  'coaching-chat': CoachingChat,
  'dose-log': DoseLog,
  'field-test': FieldTest,
  'settings': Settings,
};

function titleFromSlug(slug?: string): string {
  if (!slug) return 'Coming Soon';
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Routes /more/<slug> to its built screen, falling back to a placeholder. */
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
