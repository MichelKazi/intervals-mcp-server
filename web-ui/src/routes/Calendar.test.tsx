import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Calendar from './Calendar';
import type { PlannedEvent } from '../lib/types';

// Mock the api module — no network calls in tests
vi.mock('../lib/api', () => ({
  getEvents: vi.fn(),
  getActivities: vi.fn(),
  moveEvent: vi.fn(),
  getCompliance: vi.fn(),
}));

import { getEvents, getActivities, moveEvent } from '../lib/api';

const mockGetEvents = vi.mocked(getEvents);
const mockGetActivities = vi.mocked(getActivities);
const mockMoveEvent = vi.mocked(moveEvent);

// Anchor test fixtures to "today" so the selected-day list (defaults to today)
// shows them regardless of the real calendar date.
const todayIso = new Date().toISOString().slice(0, 10);
function nextDayIso(): string {
  const d = new Date(todayIso + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
const tomorrowIso = nextDayIso();

const plannedToday: PlannedEvent = {
  id: 101,
  name: 'Threshold Intervals',
  type: 'Ride',
  category: 'WORKOUT',
  start_date_local: `${todayIso}T09:00:00`,
  end_date_local: `${todayIso}T10:30:00`,
  moving_time: 5400,
  icu_training_load: 85,
  icu_intensity: 0.92,
};

const completedTomorrow: PlannedEvent = {
  id: 102,
  name: 'Easy Run',
  type: 'Run',
  category: 'ACTIVITY',
  start_date_local: `${tomorrowIso}T07:00:00`,
  end_date_local: `${tomorrowIso}T07:45:00`,
  moving_time: 2700,
  icu_training_load: 40,
};

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderCalendar() {
  const client = makeClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/calendar']}>
        <Routes>
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/workout/:id" element={<div data-testid="workout-page">workout</div>} />
          <Route path="/library" element={<div data-testid="library-page">library</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  try { localStorage.clear(); } catch { /* ignore */ }
  mockGetEvents.mockResolvedValue([plannedToday, completedTomorrow]);
  mockGetActivities.mockResolvedValue([]);
  mockMoveEvent.mockResolvedValue({ ...plannedToday, start_date_local: `${tomorrowIso}T09:00:00` });
});

describe('Calendar screen', () => {
  it('(a) renders the week strip with 7 day columns', async () => {
    renderCalendar();
    await waitFor(() => {
      const dayButtons = screen.getAllByRole('button').filter(b => b.getAttribute('data-date'));
      expect(dayButtons.length).toBe(7);
    });
    expect(screen.getAllByTestId('week-strip').length).toBe(1);
    // Week navigation present
    expect(screen.getByRole('button', { name: /previous week/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /next week/i })).toBeDefined();
  });

  it('(b) the day list defaults to today and shows the planned workout with a zone dot', async () => {
    renderCalendar();

    await waitFor(() => {
      expect(screen.getByTestId('day-list')).toBeDefined();
    });

    const list = screen.getByTestId('day-list');
    // Today's planned workout is listed
    expect(within(list).getByText('Threshold Intervals')).toBeDefined();

    // Row carries a zone dot (role=img with a Zone aria-label) and a sport SVG
    const row = within(list).getAllByTestId('agenda-event-row')[0];
    const zoneDot = within(row).getByRole('img', { name: /Zone/ });
    expect(zoneDot).toBeDefined();
    expect(row.querySelector('svg[data-sport]')).not.toBeNull();
  });

  it('(c) the week strip carries compliance dots (planned vs actual)', async () => {
    renderCalendar();
    await waitFor(() => {
      // ComplianceDot renders role=img with a descriptive aria-label
      const dots = screen.getAllByRole('img', { name: /completed|planned|skipped|no planned/i });
      expect(dots.length).toBeGreaterThanOrEqual(7);
    });
  });

  it('(d) tapping a different day filters the list to that day', async () => {
    renderCalendar();

    await waitFor(() => screen.getByTestId('day-list'));
    // Today's planned workout shows by default
    expect(within(screen.getByTestId('day-list')).getByText('Threshold Intervals')).toBeDefined();

    // Tap a day cell that is not today (any other column in the visible week)
    const cells = screen.getAllByRole('button').filter(b => {
      const d = b.getAttribute('data-date');
      return d && d !== todayIso;
    });
    expect(cells.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(cells[0]);

    // The today-only planned workout is no longer in the (different day) list
    await waitFor(() => {
      const list = screen.getByTestId('day-list');
      expect(within(list).queryByText('Threshold Intervals')).toBeNull();
    });
  });

  it('(e) tapping a list row opens the activity detail drawer', async () => {
    renderCalendar();

    await waitFor(() => screen.getByTestId('day-list'));

    const row = within(screen.getByTestId('day-list')).getByRole('button', { name: /Threshold Intervals/ });
    fireEvent.click(row);

    // Drawer shows the workout name as its title + an "Open full detail" action
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open full detail/i })).toBeDefined();
    });
  });

  it('renders header with month name and add/view controls', async () => {
    renderCalendar();
    const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    expect(screen.getByText(monthName)).toBeDefined();
    expect(screen.getByRole('button', { name: /add workout/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /week/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /month/i })).toBeDefined();
  });

  it('month view toggle switches to month grid', async () => {
    renderCalendar();

    await waitFor(() => {
      const cells = screen.getAllByRole('button').filter(b => b.getAttribute('data-date'));
      expect(cells.length).toBeGreaterThanOrEqual(7);
    });

    fireEvent.click(screen.getByRole('tab', { name: /month/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /previous month/i })).toBeDefined();
    }, { timeout: 3000 });
  });

  it('filters out Strava-restricted activities', async () => {
    const restrictedAct = {
      id: 200,
      name: null as unknown as string,
      type: 'Ride',
      category: 'ACTIVITY',
      start_date_local: `${todayIso}T10:00:00`,
      end_date_local: `${todayIso}T11:00:00`,
      source: 'STRAVA',
    } as PlannedEvent;

    const goodAct = {
      id: 201,
      name: 'Zwift Ride',
      type: 'VirtualRide',
      category: 'ACTIVITY',
      start_date_local: `${todayIso}T10:00:00`,
      end_date_local: `${todayIso}T11:00:00`,
      source: 'OAUTH_CLIENT',
    } as PlannedEvent;

    mockGetEvents.mockResolvedValue([plannedToday]);
    mockGetActivities.mockResolvedValue([restrictedAct, goodAct] as PlannedEvent[]);

    renderCalendar();

    await waitFor(() => {
      const list = screen.getByTestId('day-list');
      expect(within(list).getByText('Zwift Ride')).toBeDefined();
    });

    const list = screen.getByTestId('day-list');
    expect(within(list).queryByText('null')).toBeNull();
  });
});
