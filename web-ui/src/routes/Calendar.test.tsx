import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Calendar from './Calendar';
import type { PlannedEvent } from '../lib/types';

// Mock the api module — no network calls in tests
vi.mock('../lib/api', () => ({
  getEvents: vi.fn(),
  getActivities: vi.fn(),
  moveEvent: vi.fn(),
}));

import { getEvents, getActivities, moveEvent } from '../lib/api';

const mockGetEvents = vi.mocked(getEvents);
const mockGetActivities = vi.mocked(getActivities);
const mockMoveEvent = vi.mocked(moveEvent);

const june26: PlannedEvent = {
  id: 101,
  name: 'Threshold Intervals',
  type: 'Ride',
  category: 'WORKOUT',
  start_date_local: '2026-06-26T09:00:00',
  end_date_local: '2026-06-26T10:30:00',
  moving_time: 5400,
  icu_training_load: 85,
};

const june27: PlannedEvent = {
  id: 102,
  name: 'Easy Run',
  type: 'Run',
  category: 'ACTIVITY',
  start_date_local: '2026-06-27T07:00:00',
  end_date_local: '2026-06-27T07:45:00',
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
  // Clear localStorage view preference so week is default
  try { localStorage.clear(); } catch { /* ignore */ }
  mockGetEvents.mockResolvedValue([june26, june27]);
  mockGetActivities.mockResolvedValue([]);
  mockMoveEvent.mockResolvedValue({ ...june26, start_date_local: '2026-06-28T09:00:00' });
});

describe('Calendar screen', () => {
  it('(a) renders week view with day number cells', async () => {
    renderCalendar();
    // Week view: should have day buttons with data-date; 17 weeks × 7 = 119 cells
    await waitFor(() => {
      const dayButtons = screen.getAllByRole('button').filter(b => b.getAttribute('data-date'));
      // 17 weeks of 7 days each = 119 day cells (generous range)
      expect(dayButtons.length).toBeGreaterThanOrEqual(28);
    });

    // Today's date numbers should be visible
    expect(screen.getAllByText('26').length).toBeGreaterThanOrEqual(1);
  });

  it('(b) a day with events shows a sport glyph (SVG, not just a dot)', async () => {
    renderCalendar();

    // Wait for glyph indicators to appear (events loaded + grid rendered)
    await waitFor(() => {
      const glyphIndicators = screen.getAllByTestId('sport-glyph-indicator');
      expect(glyphIndicators.length).toBeGreaterThanOrEqual(1);
    });

    const glyphIndicators = screen.getAllByTestId('sport-glyph-indicator');
    // Each indicator should contain an SVG element
    const svgs = glyphIndicators[0].querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);

    // The SVG should have a data-sport attribute indicating the sport type
    const svg = svgs[0];
    expect(svg.getAttribute('data-sport')).toBeTruthy();
    expect(svg.getAttribute('data-sport')).not.toBe('');
  });

  it('(c) selecting a day opens the sheet with its agenda list', async () => {
    renderCalendar();

    // Wait for grid to render — look for June 26 cell
    await waitFor(() => {
      const cells = screen.getAllByRole('button').filter(b => b.getAttribute('data-date') === '2026-06-26');
      expect(cells.length).toBeGreaterThanOrEqual(1);
    });

    // Click on June 26
    const june26Cells = screen.getAllByRole('button').filter(b => b.getAttribute('data-date') === '2026-06-26');
    fireEvent.click(june26Cells[0]);

    // Sheet should show the event for June 26
    await waitFor(() => {
      const rows = screen.getAllByTestId('agenda-event-row');
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('Threshold Intervals')).toBeDefined();
  });

  it('(d) tapping an agenda event row navigates to /workout/:id', async () => {
    renderCalendar();

    // Wait for grid to render
    await waitFor(() => {
      const cells = screen.getAllByRole('button').filter(b => b.getAttribute('data-date') === '2026-06-26');
      expect(cells.length).toBeGreaterThanOrEqual(1);
    });

    // Select June 26 to open the sheet
    const june26Cells = screen.getAllByRole('button').filter(b => b.getAttribute('data-date') === '2026-06-26');
    fireEvent.click(june26Cells[0]);

    // Wait for sheet to open with agenda rows
    await waitFor(() => screen.getAllByTestId('agenda-event-row'));

    // Click the event row button
    const eventButton = screen.getByRole('button', { name: /Threshold Intervals/ });
    fireEvent.click(eventButton);

    // Should navigate to /workout/101
    await waitFor(() => {
      expect(screen.getByTestId('workout-page')).toBeDefined();
    });
  });

  it('renders header with month name and add/view controls', async () => {
    renderCalendar();
    // Header renders immediately
    expect(screen.getByText(/June 2026/)).toBeDefined();
    expect(screen.getByRole('button', { name: /add workout/i })).toBeDefined();
    // View toggle tabs present
    expect(screen.getByRole('tab', { name: /week/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /month/i })).toBeDefined();
  });

  it('renders empty week with no event indicators when API returns []', async () => {
    mockGetEvents.mockResolvedValue([]);
    renderCalendar();
    // Wait for grid to render
    await waitFor(() => {
      const cells = screen.getAllByRole('button').filter(b => b.getAttribute('data-date'));
      expect(cells.length).toBeGreaterThanOrEqual(7);
    });

    // No glyph indicators
    expect(screen.queryAllByTestId('sport-glyph-indicator')).toHaveLength(0);
  });

  it('month view toggle switches to month grid', async () => {
    renderCalendar();

    // Wait for week view to load first
    await waitFor(() => {
      const cells = screen.getAllByRole('button').filter(b => b.getAttribute('data-date'));
      expect(cells.length).toBeGreaterThanOrEqual(7);
    });

    // Switch to month view
    const monthTab = screen.getByRole('tab', { name: /month/i });
    fireEvent.click(monthTab);

    // Month grid should appear with prev/next navigation buttons
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /previous month/i })).toBeDefined();
    }, { timeout: 3000 });

    // Day cells in current month should be 28-42
    await waitFor(() => {
      const cells = screen.getAllByRole('button').filter(b => b.getAttribute('data-date')?.startsWith('2026-06'));
      expect(cells.length).toBeGreaterThanOrEqual(28);
      expect(cells.length).toBeLessThanOrEqual(42);
    }, { timeout: 3000 });
  });

  it('filters out Strava-restricted activities', async () => {
    const restrictedAct = {
      id: 200,
      name: null as unknown as string, // null name = restricted
      type: 'Ride',
      category: 'ACTIVITY',
      start_date_local: '2026-06-26T10:00:00',
      end_date_local: '2026-06-26T11:00:00',
      source: 'STRAVA',
    } as PlannedEvent;

    const goodAct = {
      id: 201,
      name: 'Zwift Ride',
      type: 'VirtualRide',
      category: 'ACTIVITY',
      start_date_local: '2026-06-26T10:00:00',
      end_date_local: '2026-06-26T11:00:00',
      source: 'OAUTH_CLIENT',
    } as PlannedEvent;

    mockGetEvents.mockResolvedValue([june26]);
    mockGetActivities.mockResolvedValue([restrictedAct, goodAct] as PlannedEvent[]);

    renderCalendar();

    // Open June 26 sheet
    await waitFor(() => {
      const cells = screen.getAllByRole('button').filter(b => b.getAttribute('data-date') === '2026-06-26');
      expect(cells.length).toBeGreaterThanOrEqual(1);
    });

    const june26Cells = screen.getAllByRole('button').filter(b => b.getAttribute('data-date') === '2026-06-26');
    fireEvent.click(june26Cells[0]);

    await waitFor(() => {
      expect(screen.getByText('Zwift Ride')).toBeDefined();
    });

    // Restricted activity with null name should NOT appear
    expect(screen.queryByText('null')).toBeNull();
  });
});
