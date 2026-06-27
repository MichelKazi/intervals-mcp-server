import type { ReactNode } from 'react';

export interface HomeTemplateProps {
  /** Greeting headline, e.g. "Good morning". */
  greeting?: string;
  /** Sub-line under the greeting, e.g. "Saturday · Week 2 of base block". */
  subtitle?: string;
  /** ReadinessCard slot. */
  readiness?: ReactNode;
  /** ContextStrip slot. */
  contextStrip?: ReactNode;
  /** WorkoutCard slot. */
  workout?: ReactNode;
  /** Activity rows slot. */
  activities?: ReactNode;
  className?: string;
}
