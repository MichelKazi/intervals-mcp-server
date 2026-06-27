import type { ReactNode } from 'react';

export interface EyebrowProps {
  children: ReactNode;
  /** Text color. Default muted. */
  color?: 'accent' | 'muted' | 'ghost';
  className?: string;
}
