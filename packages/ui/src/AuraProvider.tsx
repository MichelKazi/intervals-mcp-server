import React, { useMemo } from 'react';

/**
 * @component AuraProvider
 * @description Theme override layer. Injects partial token overrides as CSS
 * variables on a wrapper div; children inherit the rest of Aura via the
 * cascade. No fork needed to retheme (e.g. swap the violet accent for cyan).
 *
 * @spec
 * - colors: partial accent/bg overrides → --aura-color-* vars
 * - radius: 'sharp' | 'default' | 'round' scales every radius var
 * - motion: 'full' | 'reduced' | 'none' sets a data attr consumers can read
 * @accessibility
 * - motion='reduced'|'none' lets an app force-disable animation app-wide
 */
export interface AuraTheme {
  colors?: {
    accent?: { primary?: string; secondary?: string };
    bg?: { base?: string; surface?: string; raised?: string; high?: string };
  };
  radius?: 'sharp' | 'default' | 'round';
  motion?: 'full' | 'reduced' | 'none';
}

export interface AuraProviderProps {
  theme?: AuraTheme;
  children: React.ReactNode;
  className?: string;
}

const RADIUS_DELTA: Record<NonNullable<AuraTheme['radius']>, number> = {
  sharp: -999, // clamped to 0 below
  default: 0,
  round: 4,
};

const RADII = { sm: 6, md: 10, lg: 14, xl: 20, '2xl': 28 } as const;

function buildVars(theme?: AuraTheme): React.CSSProperties {
  const vars: Record<string, string> = {};
  if (!theme) return vars;

  const { colors, radius } = theme;
  if (colors?.accent?.primary) vars['--aura-color-accent-primary'] = colors.accent.primary;
  if (colors?.accent?.secondary) vars['--aura-color-accent-secondary'] = colors.accent.secondary;
  if (colors?.bg?.base) vars['--aura-color-bg-base'] = colors.bg.base;
  if (colors?.bg?.surface) vars['--aura-color-bg-surface'] = colors.bg.surface;
  if (colors?.bg?.raised) vars['--aura-color-bg-raised'] = colors.bg.raised;
  if (colors?.bg?.high) vars['--aura-color-bg-high'] = colors.bg.high;

  if (radius && radius !== 'default') {
    const delta = RADIUS_DELTA[radius];
    for (const [k, v] of Object.entries(RADII)) {
      vars[`--aura-radius-${k}`] = `${Math.max(0, v + delta)}px`;
    }
  }
  return vars as React.CSSProperties;
}

export function AuraProvider({ theme, children, className }: AuraProviderProps) {
  const style = useMemo(() => buildVars(theme), [theme]);
  return (
    <div data-aura-motion={theme?.motion ?? 'full'} style={style} className={className}>
      {children}
    </div>
  );
}
