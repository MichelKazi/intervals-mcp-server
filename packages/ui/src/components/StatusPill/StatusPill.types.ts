import type { ReactNode } from 'react';

export interface StatusPillProps {
  /** Semantic status driving color. */
  status: 'good' | 'caution' | 'danger' | 'neutral';
  /** Visible text. */
  label: string;
  /** Optional leading icon (emoji or node). */
  icon?: ReactNode;
  /** Pill size. @default 'sm' */
  size?: 'sm' | 'md';
  className?: string;
}
