import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

vi.mock('@/lib/api', () => ({
  getPmc: vi.fn(),
  getPowerProfile: vi.fn(),
  getZoneDistribution: vi.fn(),
  getVolume: vi.fn(),
  getWeeklyVolume: vi.fn(),
  callMcp: vi.fn(),
}));

import {
  getPmc, getPowerProfile, getZoneDistribution, getVolume, getWeeklyVolume, callMcp,
} from '@/lib/api';
import Fitness from './Fitness';
import PowerProfile from './PowerProfile';
import Volume from './Volume';
import ZoneDistribution from './ZoneDistribution';
import Aerobic from './Aerobic';
import FatigueRisk from './FatigueRisk';

// ResizeObserver is required by recharts ResponsiveContainer in jsdom.
beforeEach(() => {
  vi.clearAllMocks();
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

function renderScreen(el: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{el}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Fitness (PMC)', () => {
  it('renders ramp badge and CTL/ATL/form chips from data', async () => {
    vi.mocked(getPmc).mockResolvedValue([
      { date: '2026-05-01', ctl: 40, atl: 45, tsb: -5, rampRate: 3.2 },
      { date: '2026-06-01', ctl: 52, atl: 48, tsb: 4, rampRate: 6.1 },
    ]);
    renderScreen(<Fitness />);
    expect(await screen.findByText(/Ramp/)).toBeInTheDocument();
    expect(screen.getByText('CTL')).toBeInTheDocument();
    expect(screen.getByText(/Fitness \(CTL\)/)).toBeInTheDocument();
  });

  it('shows empty copy when no points', async () => {
    vi.mocked(getPmc).mockResolvedValue([]);
    renderScreen(<Fitness />);
    expect(await screen.findByText('No data yet.')).toBeInTheDocument();
  });
});

describe('PowerProfile', () => {
  it('renders radar legend and best-effort table', async () => {
    vi.mocked(getPowerProfile).mockResolvedValue({
      durations: [
        { secs: 5, watts: 1100, date: '2026-06-01' },
        { secs: 300, watts: 320, date: '2026-05-20' },
        { secs: 1200, watts: 280, date: '2026-05-10' },
      ],
    });
    renderScreen(<PowerProfile />);
    expect(await screen.findByText('Duration')).toBeInTheDocument();
    expect(screen.getAllByText('1100 W').length).toBeGreaterThan(0);
  });
});

describe('Volume', () => {
  it('renders both chart sections from data', async () => {
    vi.mocked(getVolume).mockResolvedValue([
      { date: '2026-06-01', tss: 80, duration_secs: 3600, type: 'Ride' },
      { date: '2026-06-03', tss: 50, duration_secs: 2400, type: 'Run' },
    ]);
    vi.mocked(getWeeklyVolume).mockResolvedValue([
      { week_start: '2026-05-26', hours: 6.5, tss: 400, sessions: 4 },
    ]);
    renderScreen(<Volume />);
    expect(await screen.findByText(/Per-session load/)).toBeInTheDocument();
    expect(screen.getByText(/Weekly hours/)).toBeInTheDocument();
  });
});

describe('ZoneDistribution', () => {
  it('renders zone legend rows with pct', async () => {
    vi.mocked(getZoneDistribution).mockResolvedValue({
      zones: [
        { zone: 'Z2', seconds: 7200, pct: 60 },
        { zone: 'Z4', seconds: 2400, pct: 20 },
      ],
      target: [],
    });
    renderScreen(<ZoneDistribution />);
    expect(await screen.findByText(/Z2/)).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });
});

describe('Aerobic', () => {
  it('renders the report text from the MCP string', async () => {
    vi.mocked(callMcp).mockResolvedValue({ result: 'Aerobic Development Analysis (8-week lookback):\nTrend: improving (+3.2%)' });
    renderScreen(<Aerobic />);
    expect(await screen.findByText(/Aerobic Development Analysis/)).toBeInTheDocument();
    expect(screen.getByText(/Coach read/)).toBeInTheDocument();
  });
});

describe('FatigueRisk', () => {
  it('pulls ACWR into a ring and renders the report', async () => {
    vi.mocked(callMcp).mockResolvedValue({ result: 'Fatigue Risk:\n  ACWR: 1.15 (sweet spot)\n  monotony: 1.4\n  strain: 320' });
    renderScreen(<FatigueRisk />);
    expect(await screen.findByText('ACWR')).toBeInTheDocument();
    expect(screen.getAllByText(/sweet spot/).length).toBeGreaterThan(0);
    expect(screen.getByText('Monotony')).toBeInTheDocument();
  });
});
