import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import safeArea from 'tailwindcss-safe-area';

const config: Config = {
  darkMode: ['class'],
  // hover: utilities only apply under @media (hover: hover) — prevents iOS Safari
  // keeping :hover backgrounds stuck after a tap (the white-row contrast bug).
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Keep the existing deliberate reset in index.css; do NOT let Tailwind's
  // preflight overwrite body/button/input and create specificity conflicts.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        // ── New token system (orange/Inter overhaul) ───────────────────────
        // `accent` is now the orange brand color (flat). Hover surfaces that
        // previously used shadcn's `bg-accent` now use `bg-muted`.
        accent: '#8b5cf6',
        bg: {
          base: '#07080f',
          surface: '#0d0e1a',
          raised: '#13152a',
          high: '#1a1d36',
        },
        status: {
          green: '#22c55e',
          yellow: '#f59e0b',
          red: '#ef4444',
        },
        border: {
          DEFAULT: 'hsl(var(--border))',
          subtle: '#1a1d36',
          default: '#242742',
          strong: '#333660',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Zone colors — endurance/tempo/threshold/vo2max/anaerobic.
        // Also referenced as var(--z1..5) in SVG attrs elsewhere.
        zone: {
          1: '#3b82f6',
          2: '#eab308',
          3: '#f97316',
          4: '#ef4444',
          5: '#a855f7',
        },
        // Legacy zone-6/7 kept: existing screens still reference them.
        'zone-6': '#c040e8',
        'zone-7': '#ff3399',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        ui: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', '"JetBrains Mono"', '"SF Mono"', 'monospace'],
        // `sans` kept (aliased) for existing screens using font-sans.
        sans: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite linear',
      },
    },
  },
  plugins: [tailwindcssAnimate, safeArea],
};

export default config;
