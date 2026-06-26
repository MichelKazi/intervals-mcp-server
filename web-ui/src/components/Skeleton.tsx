import type { CSSProperties } from 'react';

const shimmer: CSSProperties = {
  background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-2) 50%, var(--surface) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-shimmer 1.4s infinite',
  borderRadius: 'var(--radius)',
};

// Inject keyframes once
const styleId = 'skeleton-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes skeleton-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}

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
      style={{ width, height, ...shimmer, ...style }}
    />
  );
}
