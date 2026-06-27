import { Bike, Footprints, Waves, Dumbbell, Mountain, Activity, Zap } from 'lucide-react';

interface SportIconProps {
  type: string;
  size?: number;
  color?: string;
  'data-testid'?: string;
  className?: string;
}

const isRide = (t: string) =>
  t.includes('ride') || t.includes('bike') || t.includes('cycling');

const isVirtual = (t: string) =>
  t.includes('virtual') || t.includes('ebike');

const isRun = (t: string) =>
  t.includes('run') || t.includes('jog') || t.includes('trail');

const isSwim = (t: string) =>
  t.includes('swim') || t.includes('pool') || t.includes('open_water') || t.includes('aqua');

const isStrength = (t: string) =>
  t.includes('strength') || t.includes('weight') || t.includes('gym') ||
  t.includes('lift') || t.includes('yoga') || t.includes('crossfit');

const isWalk = (t: string) =>
  t.includes('walk') || t.includes('hike');

export function sportColor(type: string): string {
  const t = (type ?? '').toLowerCase();
  if (isRide(t) || isVirtual(t)) return 'var(--z5)';
  if (isRun(t)) return 'var(--z6)';
  if (isSwim(t)) return 'var(--z2)';
  if (isStrength(t)) return 'var(--z4)';
  if (isWalk(t)) return 'var(--z3)';
  return 'var(--text-dim)';
}

export function sportSvgDataAttr(type: string): string {
  const t = (type ?? '').toLowerCase();
  if (isRide(t) || isVirtual(t)) return 'bike';
  if (isRun(t)) return 'run';
  if (isSwim(t)) return 'swim';
  if (isStrength(t)) return 'strength';
  if (isWalk(t)) return 'walk';
  return 'activity';
}

export default function SportIcon({ type, size = 16, color = 'currentColor', ...rest }: SportIconProps) {
  const t = (type ?? '').toLowerCase();
  const iconProps = { size, color, strokeWidth: 2, 'aria-hidden': true, ...rest };

  if (isVirtual(t)) return <Zap data-sport="bike" {...iconProps} />;
  if (isRide(t)) return <Bike data-sport="bike" {...iconProps} />;
  if (isRun(t)) return <Footprints data-sport="run" {...iconProps} />;
  if (isSwim(t)) return <Waves data-sport="swim" {...iconProps} />;
  if (isStrength(t)) return <Dumbbell data-sport="strength" {...iconProps} />;
  if (isWalk(t)) return <Mountain data-sport="walk" {...iconProps} />;

  return <Activity data-sport="activity" {...iconProps} />;
}
