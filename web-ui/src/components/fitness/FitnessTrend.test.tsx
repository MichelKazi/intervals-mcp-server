import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FitnessTrend from './FitnessTrend';
import type { WellnessDay } from '../../lib/types';

const SAMPLE_SERIES: WellnessDay[] = Array.from({ length: 10 }, (_, i) => ({
  id: `2026-06-${String(i + 1).padStart(2, '0')}`,
  ctl: 40 + i,
  atl: 38 + i * 0.8,
}));

describe('FitnessTrend', () => {
  it('renders with a sample series', () => {
    render(<FitnessTrend series={SAMPLE_SERIES} />);
    // Legend labels must be present
    expect(screen.getByText('Fitness (CTL)')).toBeInTheDocument();
    expect(screen.getByText('Fatigue (ATL)')).toBeInTheDocument();
  });

  it('renders the figure region', () => {
    render(<FitnessTrend series={SAMPLE_SERIES} />);
    expect(screen.getByRole('figure', { name: /fitness and fatigue trend/i })).toBeInTheDocument();
  });

  it('handles empty series — renders nothing without crashing', () => {
    const { container } = render(<FitnessTrend series={[]} />);
    // Component returns null for < 2 valid points
    expect(container.firstChild).toBeNull();
  });

  it('handles single-point series — renders nothing without crashing', () => {
    const single: WellnessDay[] = [{ id: '2026-06-01', ctl: 50, atl: 48 }];
    const { container } = render(<FitnessTrend series={single} />);
    expect(container.firstChild).toBeNull();
  });

  it('handles series with null ctl/atl — does not crash', () => {
    const sparse: WellnessDay[] = [
      { id: '2026-06-01' },
      { id: '2026-06-02', ctl: 50, atl: 48 },
      { id: '2026-06-03', ctl: 51, atl: 49 },
    ];
    // Should render since 2+ valid points exist
    render(<FitnessTrend series={sparse} />);
    expect(screen.getByText('Fitness (CTL)')).toBeInTheDocument();
  });
});
