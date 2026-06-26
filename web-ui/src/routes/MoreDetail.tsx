import type { ComponentType } from 'react';
import { useParams } from 'react-router-dom';

import AppShell from '@/components/AppShell';
import PlannedVsActual from './more/PlannedVsActual';
import Polarization from './more/Polarization';
import WorkoutBuilder from './more/WorkoutBuilder';
import CoachingChat from './more/CoachingChat';
import DoseLog from './more/DoseLog';
import FieldTest from './more/FieldTest';
import Settings from './more/Settings';

// slug → component map. Parallel agents add their own entries here.
const SCREENS: Record<string, ComponentType> = {
  'planned-vs-actual': PlannedVsActual,
  polarization: Polarization,
  'workout-builder': WorkoutBuilder,
  'coaching-chat': CoachingChat,
  'dose-log': DoseLog,
  'field-test': FieldTest,
  settings: Settings,
};

function titleFromSlug(slug?: string): string {
  if (!slug) return 'Coming Soon';
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Placeholder screen for /more/<slug> until each tool is built out. */
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
