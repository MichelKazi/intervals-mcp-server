/** Inline SVG sport glyph mapped from event.type. */

interface SportGlyphProps {
  type: string;
  size?: number;
  color?: string;
  'data-testid'?: string;
  className?: string;
}

export default function SportGlyph({ type, size = 16, color = 'currentColor', ...rest }: SportGlyphProps) {
  const t = (type ?? '').toLowerCase();
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    ...rest,
  };

  if (t.includes('ride') || t.includes('bike') || t.includes('cycling') || t.includes('virtual') || t.includes('ebike')) {
    return (
      <svg {...props} data-sport="bike">
        <circle cx="5.5" cy="16.5" r="3.5" />
        <circle cx="18.5" cy="16.5" r="3.5" />
        <path d="M5.5 16.5l5-8 3 2 5-8" />
        <path d="M10.5 8.5l1.5 8" />
      </svg>
    );
  }

  if (t.includes('run') || t.includes('jog') || t.includes('trail')) {
    return (
      <svg {...props} data-sport="run">
        <circle cx="13" cy="4" r="1.5" fill={color} stroke="none" />
        <path d="M12 6l-2 4 2 2.5 1 4.5" />
        <path d="M10 10l-3 2.5" />
        <path d="M14 12.5l2.5 3" />
        <path d="M10.5 6.5l-2 1.5" />
      </svg>
    );
  }

  if (t.includes('swim') || t.includes('pool') || t.includes('open_water') || t.includes('aqua')) {
    return (
      <svg {...props} data-sport="swim">
        <path d="M2 13c1.5-2.5 3-2.5 4.5 0S9.5 15.5 11 13s3-2.5 4.5 0S18.5 15.5 20 13" />
        <circle cx="5" cy="8" r="1.5" fill={color} stroke="none" />
        <path d="M5 8l3.5 2.5 4.5-2" />
      </svg>
    );
  }

  if (t.includes('strength') || t.includes('weight') || t.includes('gym') || t.includes('lift') || t.includes('yoga') || t.includes('crossfit')) {
    return (
      <svg {...props} data-sport="strength">
        <rect x="2" y="10.5" width="3" height="3" rx="0.5" fill={color} stroke="none" />
        <rect x="19" y="10.5" width="3" height="3" rx="0.5" fill={color} stroke="none" />
        <line x1="5" y1="12" x2="19" y2="12" />
        <rect x="4.5" y="8.5" width="2" height="7" rx="0.5" />
        <rect x="17.5" y="8.5" width="2" height="7" rx="0.5" />
      </svg>
    );
  }

  if (t.includes('walk') || t.includes('hike')) {
    return (
      <svg {...props} data-sport="walk">
        <circle cx="12" cy="4" r="1.5" fill={color} stroke="none" />
        <path d="M12 6l-1 5.5 1.5 2 0.5 4.5" />
        <path d="M11 11.5l-3 3" />
        <path d="M13.5 13.5l2 3" />
        <path d="M11 8l-2 2" />
      </svg>
    );
  }

  if (t.includes('ski') || t.includes('snowboard') || t.includes('nordic')) {
    return (
      <svg {...props} data-sport="ski">
        <path d="M3 18l4-8 4 4 4-6 4 2" />
        <path d="M2 20h20" />
      </svg>
    );
  }

  if (t.includes('row') || t.includes('kayak') || t.includes('canoe') || t.includes('paddle')) {
    return (
      <svg {...props} data-sport="row">
        <path d="M4 12h16" />
        <path d="M12 4v16" />
        <path d="M4 12c0-2 4-4 8-4s8 2 8 4" />
      </svg>
    );
  }

  // Default: activity pulse
  return (
    <svg {...props} data-sport="activity">
      <polyline points="2 12 6 8 10 16 14 4 18 12 22 12" />
    </svg>
  );
}
