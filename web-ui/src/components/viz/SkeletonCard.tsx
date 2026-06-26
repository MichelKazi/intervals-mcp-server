import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface SkeletonCardProps {
  rows?: number;
  className?: string;
}

/** Shimmer placeholder card matching the default card shell. */
export default function SkeletonCard({ rows = 3, className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border-default bg-bg-surface p-5',
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton className="h-5 w-1/2" />
      {Array.from({ length: Math.max(0, rows - 1) }).map((_, i) => (
        <Skeleton key={i} className="h-3.5 w-full" />
      ))}
    </div>
  );
}
