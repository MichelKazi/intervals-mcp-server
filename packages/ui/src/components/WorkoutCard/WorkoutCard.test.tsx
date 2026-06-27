import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { WorkoutCard } from './WorkoutCard';
import type { PowerInterval } from '../PowerChart/PowerChart.types';

expect.extend(toHaveNoViolations);

const intervals: PowerInterval[] = [
  { durationSecs: 600, powerPct: 0.55, zone: 1, isWarmup: true },
  { durationSecs: 300, powerPct: 1.05, zone: 4 },
];

const base = {
  name: 'Sweet Spot Base',
  date: 'Tue, Jun 30',
  type: 'Ride',
  durationSecs: 5880,
  tss: 78,
};

describe('WorkoutCard', () => {
  it('renders name, TSS, and humanized duration', () => {
    render(<WorkoutCard {...base} />);
    expect(screen.getByText('Sweet Spot Base')).toBeInTheDocument();
    expect(screen.getByText('78 TSS')).toBeInTheDocument();
    expect(screen.getByText(/1h 38m/)).toBeInTheDocument();
  });

  it.each([
    ['planned', 'NEXT WORKOUT'],
    ['completed', 'COMPLETED'],
    ['unlogged', 'UNLOGGED'],
  ] as const)('status %s → eyebrow %s', (status, label) => {
    render(<WorkoutCard {...base} status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('defaults to NEXT WORKOUT with no status', () => {
    render(<WorkoutCard {...base} />);
    expect(screen.getByText('NEXT WORKOUT')).toBeInTheDocument();
  });

  it('never renders "MISSED", even for an unexpected status', () => {
    // @ts-expect-error exercising a bogus status value
    render(<WorkoutCard {...base} status="missed" />);
    expect(screen.queryByText(/missed/i)).toBeNull();
  });

  it('renders AdaptiveBadge when intensityFactor given', () => {
    render(<WorkoutCard {...base} intensityFactor={0.8} />);
    expect(screen.getByText('Achievable')).toBeInTheDocument();
  });

  it('renders PowerChart when intervals given', () => {
    render(
      <WorkoutCard {...base} intervals={intervals} summary="Threshold work." />,
    );
    expect(screen.getByRole('group')).toBeInTheDocument();
    expect(screen.getByText('Threshold work.')).toBeInTheDocument();
  });

  it('fires onClick and renders as a button', () => {
    const onClick = vi.fn();
    render(<WorkoutCard {...base} status="planned" onClick={onClick} />);
    const btn = screen.getByRole('button', { name: /Sweet Spot Base/ });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders as an article without onClick', () => {
    const { container } = render(<WorkoutCard {...base} />);
    expect(container.querySelector('article')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <WorkoutCard
        {...base}
        intensityFactor={0.94}
        intervals={intervals}
        summary="Threshold work."
        onClick={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
