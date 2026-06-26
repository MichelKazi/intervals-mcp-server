import type { Readiness } from '../../lib/types';

interface ReadinessBadgeProps {
  readiness: Readiness;
}

const VERDICT_MAP: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  green:  { label: 'Ready',    icon: '✓', bg: 'rgba(82,199,127,0.15)', text: '#52c77f' },
  yellow: { label: 'Moderate', icon: '⚠', bg: 'rgba(245,200,66,0.15)', text: '#f5c842' },
  red:    { label: 'Rest',     icon: '✗', bg: 'rgba(232,64,64,0.15)',   text: '#e84040' },
};

/** Presentational badge for readiness verdict. Uses color AND text+icon for accessibility. */
export default function ReadinessBadge({ readiness }: ReadinessBadgeProps) {
  const { verdict, reasoning } = readiness;
  const config = VERDICT_MAP[verdict] ?? VERDICT_MAP.yellow;

  return (
    <section
      aria-label="Readiness"
      style={{
        margin: 'var(--sp-4) var(--sp-4) 0',
        padding: 'var(--sp-3) var(--sp-4)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--sp-3)',
      }}
    >
      <span
        aria-label={`Readiness: ${config.label}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--sp-1)',
          padding: '3px var(--sp-2)',
          borderRadius: 'var(--radius-sm)',
          background: config.bg,
          color: config.text,
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <span aria-hidden="true">{config.icon}</span>
        {config.label}
      </span>
      {reasoning && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--text-dim)',
            lineHeight: 1.4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {reasoning}
        </p>
      )}
    </section>
  );
}
