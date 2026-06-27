import type { Config } from 'tailwindcss';
import tokens from './src/tokens/generated/tokens';

// Single source of truth: every value derives from tokens.json via the
// generated tokens object. Never hardcode a hex here.
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: tokens.color.bg,
        border: tokens.color.border,
        zone: tokens.color.zone,
        status: tokens.color.status,
        accent: tokens.color.accent,
        text: tokens.color.text,
      },
      spacing: tokens.spacing,
      borderRadius: tokens.radius,
      fontSize: tokens.fontSize as Record<string, string>,
      boxShadow: tokens.shadow,
      fontFamily: {
        ui: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'SF Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
