export interface CoachReadCardProps {
  /** Derived training-history summary. */
  trainingHistory?: string | null;
  /** Derived adherence/dropout pattern. */
  dropoutRisk?: string | null;
  /** ISO timestamp the coach read was last refreshed, or null. */
  refreshedAt?: string | null;
  className?: string;
}
