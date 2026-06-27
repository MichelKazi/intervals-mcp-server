// AUTO-GENERATED from src/tokens/tokens.json — do not edit by hand.
const tokens = {
  "color": {
    "bg": {
      "void": "#04050c",
      "base": "#07080f",
      "surface": "#0d0e1a",
      "raised": "#13152a",
      "high": "#1a1d36"
    },
    "border": {
      "subtle": "#1a1d36",
      "default": "#242742",
      "strong": "#333660",
      "accent": "#8b5cf640"
    },
    "zone": {
      "1": "#3b82f6",
      "2": "#eab308",
      "3": "#f97316",
      "4": "#ef4444",
      "5": "#a855f7"
    },
    "status": {
      "good": "#22c55e",
      "caution": "#f59e0b",
      "danger": "#ef4444"
    },
    "accent": {
      "primary": "#8b5cf6",
      "secondary": "#6366f1",
      "glow": "#8b5cf620"
    },
    "text": {
      "primary": "#f0f2ff",
      "secondary": "#9ea3c8",
      "muted": "#4a4d6e",
      "ghost": "#2a2d4c"
    }
  },
  "spacing": {
    "0": "0px",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px"
  },
  "radius": {
    "sm": "6px",
    "md": "10px",
    "lg": "14px",
    "xl": "20px",
    "2xl": "28px",
    "full": "9999px"
  },
  "fontSize": {
    "xs": "10px",
    "sm": "12px",
    "base": "14px",
    "md": "16px",
    "lg": "18px",
    "xl": "21px",
    "2xl": "28px",
    "3xl": "40px"
  },
  "shadow": {
    "elevation1": "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
    "elevation2": "0 4px 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4)",
    "elevation3": "0 16px 40px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.4)",
    "glowAccent": "0 0 20px rgba(139,92,246,0.3), 0 0 40px rgba(139,92,246,0.15)",
    "glowGood": "0 0 16px rgba(34,197,94,0.3)",
    "glowCaution": "0 0 16px rgba(245,158,11,0.3)",
    "glowDanger": "0 0 16px rgba(239,68,68,0.3)",
    "innerHighlight": "inset 0 1px 0 rgba(255,255,255,0.06)"
  }
} as const;

export default tokens;
export type Tokens = typeof tokens;
