import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  style?: CSSProperties;
}

/** Animated shimmer placeholder. Use while content is loading. */
export default function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className="skeleton-shimmer animate-shimmer rounded-md"
      style={{ width, height, ...style }}
    />
  );
}
