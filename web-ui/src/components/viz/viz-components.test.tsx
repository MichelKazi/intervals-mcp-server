import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  MetricRing,
  SparkLine,
  ZoneDot,
  ZoneBadge,
  AdaptiveBadge,
  ComplianceDot,
  ContributorRow,
  SkeletonCard,
} from './index';

describe('MetricRing', () => {
  it('renders the value and label', () => {
    render(<MetricRing value={75} max={100} color="#f97316" label="Readiness" />);
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('Readiness')).toBeInTheDocument();
  });

  it('renders at each size without crashing', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { container } = render(
        <MetricRing value={50} max={100} color="#f97316" label="L" size={size} />,
      );
      expect(container.querySelector('svg')).toBeInTheDocument();
    }
  });
});

describe('SparkLine', () => {
  it('renders a polyline for data', () => {
    const { container } = render(<SparkLine data={[1, 2, 3, 2, 1]} color="#f97316" />);
    expect(container.querySelector('polyline')).toBeInTheDocument();
  });

  it('renders an empty svg for no data', () => {
    const { container } = render(<SparkLine data={[]} color="#f97316" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('polyline')).not.toBeInTheDocument();
  });
});

describe('ZoneDot', () => {
  it('exposes an aria-label with the zone number', () => {
    render(<ZoneDot zone={3} />);
    expect(screen.getByRole('img', { name: /Zone 3/i })).toBeInTheDocument();
  });
});

describe('ZoneBadge', () => {
  it('renders a custom label', () => {
    render(<ZoneBadge zone={2} label="Tempo" />);
    expect(screen.getByText('Tempo')).toBeInTheDocument();
  });

  it('renders a neutral pill with no zone', () => {
    render(<ZoneBadge label="All zones" />);
    expect(screen.getByText('All zones')).toBeInTheDocument();
  });
});

describe('AdaptiveBadge', () => {
  it('shows Achievable for IF 0.80', () => {
    render(<AdaptiveBadge ifValue={0.8} />);
    expect(screen.getByText('Achievable')).toBeInTheDocument();
  });
  it('shows Productive for IF 0.90', () => {
    render(<AdaptiveBadge ifValue={0.9} />);
    expect(screen.getByText('Productive')).toBeInTheDocument();
  });
  it('shows Stretch for IF 0.97', () => {
    render(<AdaptiveBadge ifValue={0.97} />);
    expect(screen.getByText('Stretch')).toBeInTheDocument();
  });
  it('shows Breakthrough for IF 1.05', () => {
    render(<AdaptiveBadge ifValue={1.05} />);
    expect(screen.getByText('Breakthrough')).toBeInTheDocument();
  });
});

describe('ComplianceDot', () => {
  it('shows a dash when there is no planned load', () => {
    render(<ComplianceDot />);
    expect(screen.getByRole('img', { name: /No planned workout/i })).toBeInTheDocument();
  });
  it('labels a skipped workout', () => {
    render(<ComplianceDot planned={100} actual={null} />);
    expect(screen.getByRole('img', { name: /Skipped/i })).toBeInTheDocument();
  });
  it('labels an on-target workout', () => {
    render(<ComplianceDot planned={100} actual={98} />);
    expect(screen.getByRole('img', { name: /within 10%/i })).toBeInTheDocument();
  });
  it('labels an off-target workout', () => {
    render(<ComplianceDot planned={100} actual={50} />);
    expect(screen.getByRole('img', { name: /more than 25%/i })).toBeInTheDocument();
  });
});

describe('ContributorRow', () => {
  it('renders the label and rounded score', () => {
    render(<ContributorRow label="HRV" score={85} />);
    expect(screen.getByText('HRV')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });
});

describe('SkeletonCard', () => {
  it('renders without crashing', () => {
    const { container } = render(<SkeletonCard rows={2} />);
    expect(container.firstChild).toBeTruthy();
  });
});
