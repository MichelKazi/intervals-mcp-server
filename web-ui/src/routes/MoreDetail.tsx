import type { ComponentType } from 'react';
import { useParams } from 'react-router-dom';

import AppShell from '@/components/AppShell';

// ─── Slug → screen registry ──────────────────────────────────────────────────
// Each batch of More-tab screens registers ONLY its own slugs here. Keep entries
// additive and alphabetical within a batch so parallel edits merge cleanly.
//
// ── ANALYTICS batch ──
import Fitness from './more/Fitness';
import PowerProfile from './more/PowerProfile';
import Volume from './more/Volume';
import ZoneDistribution from './more/ZoneDistribution';
import Aerobic from './more/Aerobic';
import FatigueRisk from './more/FatigueRisk';

const SCREENS: Record<string, ComponentType> = {
  // ── ANALYTICS batch ──
  'fitness': Fitness,
  'power-profile': PowerProfile,
  'volume': Volume,
  'zone-distribution': ZoneDistribution,
  'aerobic': Aerobic,
  'fatigue': FatigueRisk,
};

function titleFromSlug(slug?: string): string {
  if (!slug) return 'Coming Soon';
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Routes /more/<slug> to its screen, falling back to a placeholder. */
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
