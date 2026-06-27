import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Activities from './Activities';

vi.mock('../lib/api', () => ({
  getActivities: vi.fn(),
}));

import { getActivities } from '../lib/api';

const MOCK_ACTIVITIES = [
  {
    id: 1,
    name: 'Morning Ride',
    type: 'Ride',
    category: 'WORKOUT',
    start_date_local: '2026-06-25T07:00:00',
    end_date_local: '2026-06-25T08:00:00',
    moving_time: 3600,
    distance: 45000,
    icu_training_load: 70,
  },
  {
    id: 2,
    name: 'Strava Only',
    type: 'Ride',
    category: 'WORKOUT',
    start_date_local: '2026-06-24T06:00:00',
    end_date_local: '2026-06-24T07:00:00',
    source: 'STRAVA',
  },
  {
    id: 3,
    name: 'Noted Activity',
    type: 'Run',
    category: 'WORKOUT',
    start_date_local: '2026-06-23T06:00:00',
    end_date_local: '2026-06-23T07:00:00',
    _note: 'some note',
  },
];

function LocationCapture({ onLocation }: { onLocation: (p: string) => void }) {
  const loc = useLocation();
  onLocation(loc.pathname);
  return null;
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  let capturedPath = '/activities';

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/activities']}>
          <Routes>
            <Route path="/activities" element={<>{children}</>} />
            <Route
              path="/workout/:id"
              element={<LocationCapture onLocation={(p) => { capturedPath = p; }} />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { Wrapper, getPath: () => capturedPath };
}

beforeEach(() => {
  vi.mocked(getActivities).mockResolvedValue(MOCK_ACTIVITIES as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Activities', () => {
  it('renders activity rows from mocked getActivities', async () => {
    const { Wrapper } = makeWrapper();
    render(<Activities />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('Morning Ride')).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('filters out activities with source === "STRAVA"', async () => {
    const { Wrapper } = makeWrapper();
    render(<Activities />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('Morning Ride')).toBeInTheDocument(), {
      timeout: 3000,
    });

    expect(screen.queryByText('Strava Only')).not.toBeInTheDocument();
  });

  it('filters out activities with _note truthy', async () => {
    const { Wrapper } = makeWrapper();
    render(<Activities />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('Morning Ride')).toBeInTheDocument(), {
      timeout: 3000,
    });

    expect(screen.queryByText('Noted Activity')).not.toBeInTheDocument();
  });

  it('clicking a row navigates to /workout/:id', async () => {
    const { Wrapper, getPath } = makeWrapper();
    render(<Activities />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('Morning Ride')).toBeInTheDocument(), {
      timeout: 3000,
    });

    fireEvent.click(screen.getByText('Morning Ride'));

    await waitFor(() => expect(getPath()).toBe('/workout/1'), { timeout: 2000 });
  });
});
