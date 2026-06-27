import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PMCChart, filterByPeriod } from './PMCChart';
import type { PMCDataPoint } from './PMCChart.types';

expect.extend(toHaveNoViolations);

function build(n: number): PMCDataPoint[] {
  const start = new Date('2026-01-01');
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return { date: d.toISOString().slice(0, 10), ctl: 40 + i, atl: 38 + i, tsb: 2 - i };
  });
}

describe('filterByPeriod', () => {
  const data = build(100);

  it('4w returns last 28', () => {
    expect(filterByPeriod(data, '4w')).toHaveLength(28);
  });

  it('8w returns last 56', () => {
    expect(filterByPeriod(data, '8w')).toHaveLength(56);
  });

  it('12w returns last 84', () => {
    expect(filterByPeriod(data, '12w')).toHaveLength(84);
  });

  it('all returns the full set', () => {
    expect(filterByPeriod(data, 'all')).toHaveLength(100);
  });

  it('slices from the end', () => {
    expect(filterByPeriod(data, '4w')[0].date).toBe(data[72].date);
  });

  it('shorter-than-window data returns unchanged length', () => {
    const short = build(10);
    expect(filterByPeriod(short, '12w')).toHaveLength(10);
  });
});

describe('PMCChart', () => {
  it('renders empty state with no data', () => {
    render(<PMCChart data={[]} />);
    expect(screen.getByText('No PMC data')).toBeInTheDocument();
  });

  it('renders without crashing on real data', () => {
    const { container } = render(
      <div style={{ width: 600, height: 200 }}>
        <PMCChart data={build(60)} />
      </div>,
    );
    expect(container.querySelector('[role="img"]')).toBeInTheDocument();
  });

  it('renders toggle pills and switches period when interactive', async () => {
    render(
      <div style={{ width: 600, height: 200 }}>
        <PMCChart data={build(60)} interactive period="8w" />
      </div>,
    );
    const eightW = screen.getByRole('button', { name: '8w' });
    expect(eightW).toHaveAttribute('aria-pressed', 'true');

    const fourW = screen.getByRole('button', { name: '4w' });
    await userEvent.click(fourW);
    expect(fourW).toHaveAttribute('aria-pressed', 'true');
    expect(eightW).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides toggle pills when not interactive', () => {
    render(
      <div style={{ width: 600, height: 200 }}>
        <PMCChart data={build(60)} />
      </div>,
    );
    expect(screen.queryByRole('group', { name: 'Chart period' })).not.toBeInTheDocument();
  });

  it('empty state has no a11y violations', async () => {
    const { container } = render(<PMCChart data={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
