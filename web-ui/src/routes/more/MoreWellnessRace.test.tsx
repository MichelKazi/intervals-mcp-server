import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import MoreDetail from '../MoreDetail';
import type { WellnessDay, Activity } from '../../lib/types';

vi.mock('../../lib/api', () => ({
  getWellness: vi.fn(),
  getActivities: vi.fn(),
  callMcpText: vi.fn(),
}));

import { getWellness, getActivities, callMcpText } from '../../lib/api';

const mockWellness = vi.mocked(getWellness);
const mockActivities = vi.mocked(getActivities);
const mockMcp = vi.mocked(callMcpText);

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const wellnessDays: WellnessDay[] = Array.from({ length: 30 }, (_, i) => ({
  id: isoDaysAgo(29 - i),
  ctl: 50,
  atl: 55,
  hrv: 50 + (i % 10),
  restingHR: 48 + (i % 4),
  sleepSecs: 25000 + i * 100,
  sleepScore: 70 + (i % 20),
  readiness: 60 + (i % 30),
  weight: i % 2 === 0 ? 72 + i * 0.05 : null,
} as WellnessDay));

const rides: Activity[] = [
  { id: 1, name: 'Threshold 3x13', type: 'Ride', category: 'ACTIVITY', start_date_local: isoDaysAgo(3) + 'T09:00', end_date_local: '', moving_time: 4800, icu_weighted_avg_watts: 280, icu_ftp: 290, max_watts: 900, source: 'OAUTH_CLIENT' } as Activity,
  { id: 2, name: 'Long endurance', type: 'Ride', category: 'ACTIVITY', start_date_local: isoDaysAgo(5) + 'T08:00', end_date_local: '', moving_time: 4200, icu_weighted_avg_watts: 230, icu_ftp: 290, source: 'OAUTH_CLIENT' } as Activity,
];

function renderSlug(slug: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/more/${slug}`]}>
        <Routes>
          <Route path="/more/:slug" element={<MoreDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWellness.mockResolvedValue(wellnessDays);
  mockActivities.mockResolvedValue(rides);
  mockMcp.mockResolvedValue('Recovery Pattern Analysis\n\nKey Takeaways:\n  Sleep matters.');
});

describe('More Wellness + Race screens', () => {
  it('Sleep renders score ring and trend sections', async () => {
    renderSlug('sleep');
    await waitFor(() => expect(screen.getByText(/Sleep Score/i)).toBeDefined());
    expect(screen.getByText(/Last 14 nights/i)).toBeDefined();
    expect(screen.getByText(/HRV \(30 days\)/i)).toBeDefined();
  });

  it('Sleep shows empty state when no sleep data', async () => {
    mockWellness.mockResolvedValue([{ id: isoDaysAgo(0) }] as WellnessDay[]);
    renderSlug('sleep');
    await waitFor(() => expect(screen.getByText(/check Oura connection/i)).toBeDefined());
  });

  it('ReadinessHistory renders a 30-day heatmap with readiness cells', async () => {
    renderSlug('readiness-history');
    await waitFor(() => expect(screen.getByText(/Last 30 days/i)).toBeDefined());
    const cells = screen.getAllByRole('img', { name: /readiness|unlogged/i });
    expect(cells.length).toBeGreaterThanOrEqual(30);
  });

  it('BodyMetrics renders rolling-average weight chart with W/kg', async () => {
    renderSlug('body-metrics');
    await waitFor(() => expect(screen.getByText(/7-day rolling average/i)).toBeDefined());
    expect(screen.getByText(/Current W\/kg/i)).toBeDefined();
  });

  it('BodyMetrics shows empty state when no weight logged', async () => {
    mockWellness.mockResolvedValue(wellnessDays.map((d) => ({ ...d, weight: null })));
    renderSlug('body-metrics');
    await waitFor(() => expect(screen.getByText(/No weight logged/i)).toBeDefined());
  });

  it('RaceHub shows empty state when race tool returns nothing', async () => {
    mockMcp.mockResolvedValue(null);
    renderSlug('race-hub');
    await waitFor(() => expect(screen.getByText(/First one's coming/i)).toBeDefined());
  });

  it('RaceHub renders a countdown when a future date is present', async () => {
    mockMcp.mockResolvedValue('A Race: 2027-08-15 in Boulder');
    renderSlug('race-hub');
    await waitFor(() => expect(screen.getByText(/A-Race Countdown/i)).toBeDefined());
    expect(screen.getByText(/days to go/i)).toBeDefined();
  });

  it('RaceReadiness renders four checklist indicators', async () => {
    renderSlug('race-readiness');
    await waitFor(() => expect(screen.getByText(/Hold 95–100% FTP/i)).toBeDefined());
    expect(screen.getByText(/Repeat 30s surges/i)).toBeDefined();
    expect(screen.getByText(/Mixed 60–90 min/i)).toBeDefined();
    expect(screen.getByText(/Sprint power stable/i)).toBeDefined();
  });
});
