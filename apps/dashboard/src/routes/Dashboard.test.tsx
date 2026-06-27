import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Dashboard from './Dashboard';
import type { Dashboard as DashboardData, Activity } from '../lib/types';

// ─── Mock the API module ──────────────────────────────────────────────────────

vi.mock('../lib/api', () => ({
  getDashboard: vi.fn(),
  getWellness: vi.fn(),
  getActivities: vi.fn(),
  getEvents: vi.fn(),
  getActivePlan: vi.fn(),
}));

import { getDashboard, getWellness, getActivities, getEvents, getActivePlan } from '../lib/api';
const mockGetDashboard = vi.mocked(getDashboard);
const mockGetWellness = vi.mocked(getWellness);
const mockGetActivities = vi.mocked(getActivities);
const mockGetEvents = vi.mocked(getEvents);
const mockGetActivePlan = vi.mocked(getActivePlan);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function LocationCapture({ onLocation }: { onLocation: (p: string) => void }) {
  const loc = useLocation();
  onLocation(loc.pathname);
  return null;
}

function renderDashboard() {
  const client = makeClient();
  let capturedPath = '/';

  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workout/:id" element={<LocationCapture onLocation={(p) => { capturedPath = p; }} />} />
          <Route path="/calendar" element={<div data-testid="calendar-page" />} />
          <Route path="/library" element={<div data-testid="library-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...result, getPath: () => capturedPath };
}

const SAMPLE_DATA: DashboardData = {
  next_workout: {
    id: 42,
    name: 'Threshold Intervals',
    type: 'Ride',
    category: 'WORKOUT',
    start_date_local: '2026-06-27T09:00:00',
    end_date_local: '2026-06-27T10:00:00',
    moving_time: 3600,
    icu_training_load: 85,
    icu_ftp: 280,
    workout_doc: undefined,
  },
  latest_activity: null,
  readiness: {
    verdict: 'green',
    reasoning: 'HRV is elevated and fatigue is low.',
  },
};

const SAMPLE_WELLNESS = [
  { id: '2026-06-20', ctl: 48, atl: 50, hrv: 40, restingHR: 52, sleepScore: 70, readiness: 70 },
  { id: '2026-06-21', ctl: 49, atl: 50, readiness: 65 },
  { id: '2026-06-22', ctl: 50, atl: 50, readiness: 72 },
  { id: '2026-06-23', ctl: 51, atl: 50, readiness: 80 },
  { id: '2026-06-24', ctl: 52, atl: 50, readiness: 78 },
  { id: '2026-06-25', ctl: 53, atl: 50, readiness: 82 },
  { id: '2026-06-26', ctl: 55, atl: 50, hrv: 36, restingHR: 50, sleepScore: 79, readiness: 84 },
];

const SAMPLE_PLANNED = [
  {
    id: 99, name: 'Planned Threshold', type: 'Ride', category: 'WORKOUT',
    start_date_local: '2026-06-26T09:00:00', end_date_local: '2026-06-26T10:00:00',
    icu_training_load: 90,
  },
];

const SAMPLE_ACTIVITIES: Activity[] = [
  {
    id: 'i1', name: 'Morning Endurance', type: 'Ride', category: 'WORKOUT',
    start_date_local: '2026-06-25T07:00:00', end_date_local: '2026-06-25T08:30:00',
    moving_time: 5400, distance: 45000, icu_training_load: 70,
  },
  {
    id: 'i2', name: 'STRAVA hidden', type: 'Ride', category: 'WORKOUT',
    start_date_local: '2026-06-24T07:00:00', end_date_local: '2026-06-24T08:00:00',
    moving_time: 3000, icu_training_load: 40, source: 'STRAVA',
  } as Activity,
];

beforeEach(() => {
  mockGetDashboard.mockClear();
  mockGetWellness.mockResolvedValue(SAMPLE_WELLNESS);
  mockGetActivities.mockResolvedValue(SAMPLE_ACTIVITIES);
  mockGetEvents.mockResolvedValue(SAMPLE_PLANNED as never);
  mockGetActivePlan.mockResolvedValue({ plan: null });
});

describe('Dashboard', () => {
  it('(a) renders the readiness card with a verdict word', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);
    renderDashboard();
    await waitFor(() => expect(screen.getByLabelText('Readiness')).toBeInTheDocument());
    expect(screen.getByText('READY')).toBeInTheDocument();
  });

  it('(b) renders next-workout card with name and duration', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Threshold Intervals')).toBeInTheDocument());
    expect(screen.getByText(/1h00m/)).toBeInTheDocument();
  });

  it('(c) next-workout card click navigates to /workout/:id', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);
    const { getPath } = renderDashboard();
    const hero = await screen.findByRole('button', { name: /Next workout: Threshold Intervals/i });
    fireEvent.click(hero);
    expect(getPath()).toBe('/workout/42');
  });

  it('(d) loading state shows skeleton', () => {
    mockGetDashboard.mockReturnValueOnce(new Promise(() => {}));
    renderDashboard();
    expect(screen.getByLabelText('Loading dashboard')).toBeInTheDocument();
  });

  it('(e) null next_workout shows rest-day empty state', async () => {
    mockGetDashboard.mockResolvedValueOnce({ ...SAMPLE_DATA, next_workout: null });
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Rest day.')).toBeInTheDocument());
    expect(screen.getByText('Recovery is training.')).toBeInTheDocument();
  });

  it('readiness shows "REST" for red verdict', async () => {
    mockGetDashboard.mockResolvedValueOnce({
      ...SAMPLE_DATA,
      readiness: { verdict: 'red', reasoning: 'Fatigue is very high.' },
    });
    renderDashboard();
    await waitFor(() => expect(screen.getByText('REST')).toBeInTheDocument());
  });

  it('readiness shows "MODERATE" for yellow verdict', async () => {
    mockGetDashboard.mockResolvedValueOnce({
      ...SAMPLE_DATA,
      readiness: { verdict: 'yellow', reasoning: 'Mild fatigue detected.' },
    });
    renderDashboard();
    await waitFor(() => expect(screen.getByText('MODERATE')).toBeInTheDocument());
  });

  it('readiness card opens contributor breakdown on tap', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);
    renderDashboard();
    const card = await screen.findByLabelText('Readiness');
    fireEvent.click(card);
    await waitFor(() => expect(screen.getByText('Contributors')).toBeInTheDocument());
    expect(screen.getByText('HRV')).toBeInTheDocument();
    expect(screen.getByText('Sleep')).toBeInTheDocument();
  });

  it('recent list renders accessible activities and filters STRAVA', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Morning Endurance')).toBeInTheDocument());
    expect(screen.queryByText('STRAVA hidden')).not.toBeInTheDocument();
  });

  it('recent empty state shows when no activities', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);
    mockGetActivities.mockResolvedValueOnce([]);
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Nothing logged yet. Ride something.')).toBeInTheDocument());
  });

  it('shows error message and retry button on fetch failure', async () => {
    mockGetDashboard.mockRejectedValueOnce(new Error('Network error'));
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/Network error/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('load-match strip shows planned TSS', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/TSS planned/i)).toBeInTheDocument());
  });

  it('renders the 7-day readiness trend strip with the latest score', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);
    renderDashboard();
    const strip = await screen.findByTestId('readiness-trend');
    expect(strip).toHaveTextContent('7-day');
    expect(strip).toHaveTextContent('84'); // latest readiness score
  });

  it('renders the this-week summary with completed/planned TSS, sessions, hours', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);
    renderDashboard();
    const card = await screen.findByTestId('this-week');
    expect(card).toHaveTextContent('This Week');
    // Morning Endurance (70 TSS, 1.5h) is in-week; planned is 90.
    expect(card).toHaveTextContent('70 / 90');
    expect(card).toHaveTextContent('1.5'); // hours
    expect(card).toHaveTextContent('% of planned load');
  });
});
