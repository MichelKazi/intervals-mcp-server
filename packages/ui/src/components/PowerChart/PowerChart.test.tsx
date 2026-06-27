import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PowerChart } from './PowerChart';
import type { PowerInterval } from './PowerChart.types';
import { ZONE_COLORS } from '../../lib/zones';

expect.extend(toHaveNoViolations);

function build(overrides: Partial<PowerInterval>[] = []): PowerInterval[] {
  const base: PowerInterval[] = [
    { durationSecs: 600, powerPct: 0.5, zone: 1, isWarmup: true, label: 'Warmup' },
    { durationSecs: 480, powerPct: 1.0, zone: 3, label: 'Threshold' },
    { durationSecs: 300, powerPct: 0.45, zone: 1, isCooldown: true, label: 'Cooldown' },
  ];
  return overrides.length ? (overrides as PowerInterval[]) : base;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PowerChart', () => {
  it('renders one bar per interval inside the chart group', () => {
    render(<PowerChart intervals={build()} summary="x" interactive />);
    const group = screen.getByRole('group');
    expect(group.querySelectorAll('[role="button"]')).toHaveLength(3);
  });

  it('renders empty state when no intervals', () => {
    render(<PowerChart intervals={[]} />);
    expect(screen.getByText('No workout data')).toBeInTheDocument();
  });

  it('forces warmup/cooldown bars to zone-1 color at 50% opacity', () => {
    render(<PowerChart intervals={build()} summary="x" interactive />);
    const warmupBar = screen.getByRole('button', { name: /Endurance.*50% FTP/ });
    expect(warmupBar).toHaveStyle({ opacity: '0.5' });
    expect(warmupBar.style.background).toContain(ZONE_COLORS[1]);
  });

  it('draws the FTP line when ftpLine is true and omits it when false', () => {
    const { rerender, container } = render(
      <PowerChart intervals={build()} summary="x" ftpLine />,
    );
    expect(screen.getByText('FTP')).toBeInTheDocument();
    rerender(<PowerChart intervals={build()} summary="x" ftpLine={false} />);
    expect(screen.queryByText('FTP')).not.toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it('renders the summary text', () => {
    render(<PowerChart intervals={build()} summary="3x8 at threshold" />);
    expect(screen.getByText('3x8 at threshold')).toBeInTheDocument();
  });

  it('warns when a zone>=3 interval has no summary', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<PowerChart intervals={build()} />);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('summary'));
  });

  it('does not warn for an endurance-only session', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <PowerChart
        intervals={[{ durationSecs: 3600, powerPct: 0.65, zone: 1, label: 'Easy' }]}
      />,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when summary is provided for an intensity session', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<PowerChart intervals={build()} summary="threshold work" />);
    expect(warn).not.toHaveBeenCalled();
  });

  it('shows a readout when an interactive bar is clicked', () => {
    render(<PowerChart intervals={build()} summary="x" interactive />);
    fireEvent.click(screen.getByRole('button', { name: /Threshold, 100% FTP/ }));
    expect(screen.getByText(/Threshold — Threshold, 100% FTP/)).toBeInTheDocument();
  });

  it('moves selection with arrow keys', () => {
    render(<PowerChart intervals={build()} summary="x" interactive />);
    const bars = screen.getAllByRole('button');
    fireEvent.keyDown(bars[0], { key: 'ArrowRight' });
    expect(screen.getByText(/Threshold/)).toBeInTheDocument();
  });

  it('renders a legend for present zones when showLegend', () => {
    render(<PowerChart intervals={build()} summary="x" showLegend />);
    const legend = screen.getByRole('list', { name: 'Zone legend' });
    expect(legend).toBeInTheDocument();
    expect(screen.getByText('Threshold')).toBeInTheDocument();
  });

  it('uses flat fill when gradientBars is false', () => {
    render(
      <PowerChart intervals={build()} summary="x" interactive gradientBars={false} />,
    );
    const bar = screen.getByRole('button', { name: /Threshold, 100% FTP/ });
    expect(bar.style.background).not.toContain('gradient');
    // jsdom normalizes a bare hex color to rgb(); gradient strings keep the hex.
    expect(bar.style.background).toBe('rgb(249, 115, 22)');
    expect(ZONE_COLORS[3]).toBe('#f97316');
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <PowerChart intervals={build()} summary="3x8 at threshold" interactive showLegend />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
