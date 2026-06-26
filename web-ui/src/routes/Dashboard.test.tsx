import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Dashboard from './Dashboard';
import type { Dashboard as DashboardData } from '../lib/types';

// ─── Mock the API module ──────────────────────────────────────────────────────

vi.mock('../lib/api', () => ({
  getDashboard: vi.fn(),
  getWellness: vi.fn(),
}));

import { getDashboard, getWellness } from '../lib/api';
const mockGetDashboard = vi.mocked(getDashboard);
const mockGetWellness = vi.mocked(getWellness);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/** Capture the current location so we can assert navigation. */
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
          <Route
            path="/workout/:id"
            element={<LocationCapture onLocation={(p) => { capturedPath = p; }} />}
          />
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
  latest_activity: {
    id: 99,
    name: 'Morning Endurance',
    type: 'Ride',
    category: 'WORKOUT',
    start_date_local: '2026-06-25T07:00:00',
    end_date_local: '2026-06-25T08:30:00',
    moving_time: 5400,
    distance: 45000,
    icu_training_load: 70,
  },
  readiness: {
    verdict: 'green',
    reasoning: 'HRV is elevated and fatigue is low.',
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

const SAMPLE_WELLNESS = [
  { id: '2026-06-01', ctl: 48, atl: 50 },
  { id: '2026-06-26', ctl: 50, atl: 50 },
];

beforeEach(() => {
  mockGetDashboard.mockClear();
  // Default: resolve with minimal wellness data so FitnessSection renders without errors
  mockGetWellness.mockResolvedValue(SAMPLE_WELLNESS);
});

describe('Dashboard', () => {
  it('(a) renders next-workout hero with name and duration when data is present', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);

    renderDashboard();

    await waitFor(() => expect(screen.getByText('Threshold Intervals')).toBeInTheDocument());

    // Name visible
    expect(screen.getByText('Threshold Intervals')).toBeInTheDocument();
    // Duration: 3600s = "1h00m" (canonical formatDuration)
    expect(screen.getByText(/1h00m/)).toBeInTheDocument();
  });

  it('(b) hero card click navigates to /workout/:id', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);

    const { getPath } = renderDashboard();

    const hero = await screen.findByRole('button', { name: /Next workout: Threshold Intervals/i });
    fireEvent.click(hero);

    expect(getPath()).toBe('/workout/42');
  });

  it('(c) loading state shows skeleton (aria-busy container)', () => {
    // Never resolves during this test
    mockGetDashboard.mockReturnValueOnce(new Promise(() => {}));

    renderDashboard();

    expect(screen.getByLabelText('Loading dashboard')).toBeInTheDocument();
  });

  it('(d) null next_workout shows empty state message', async () => {
    mockGetDashboard.mockResolvedValueOnce({
      ...SAMPLE_DATA,
      next_workout: null,
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByText('No upcoming workout')).toBeInTheDocument());
    // Browse library link
    expect(screen.getByRole('link', { name: /Browse library/i })).toBeInTheDocument();
  });

  it('(e) readiness badge shows verdict text (not just color)', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);

    renderDashboard();

    // Should show the text label "Ready", not just green color
    await waitFor(() => expect(screen.getByText('Ready')).toBeInTheDocument());
  });

  it('readiness badge shows "Rest" for red verdict', async () => {
    mockGetDashboard.mockResolvedValueOnce({
      ...SAMPLE_DATA,
      readiness: { verdict: 'red', reasoning: 'Fatigue is very high.' },
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByText('Rest')).toBeInTheDocument());
  });

  it('readiness badge shows "Moderate" for yellow verdict', async () => {
    mockGetDashboard.mockResolvedValueOnce({
      ...SAMPLE_DATA,
      readiness: { verdict: 'yellow', reasoning: 'Mild fatigue detected.' },
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByText('Moderate')).toBeInTheDocument());
  });

  it('latest activity is omitted when null', async () => {
    mockGetDashboard.mockResolvedValueOnce({
      ...SAMPLE_DATA,
      latest_activity: null,
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByText('Threshold Intervals')).toBeInTheDocument());
    expect(screen.queryByText('Last Activity')).not.toBeInTheDocument();
  });

  it('latest activity name is shown when present', async () => {
    mockGetDashboard.mockResolvedValueOnce(SAMPLE_DATA);

    renderDashboard();

    await waitFor(() => expect(screen.getByText('Morning Endurance')).toBeInTheDocument());
  });

  it('shows error message and retry button on fetch failure', async () => {
    mockGetDashboard.mockRejectedValueOnce(new Error('Network error'));

    renderDashboard();

    await waitFor(() => expect(screen.getByText(/Network error/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
