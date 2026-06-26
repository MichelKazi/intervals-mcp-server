import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Calendar from './Calendar';
import type { PlannedEvent } from '../lib/types';

// Mock the api module — no network calls in tests
vi.mock('../lib/api', () => ({
  getEvents: vi.fn(),
  moveEvent: vi.fn(),
}));

import { getEvents, moveEvent } from '../lib/api';

const mockGetEvents = vi.mocked(getEvents);
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
  mockGetEvents.mockResolvedValue([june26, june27]);
  mockMoveEvent.mockResolvedValue({ ...june26, start_date_local: '2026-06-28T09:00:00' });
});

describe('Calendar screen', () => {
  it('(a) renders month grid with day numbers', async () => {
    renderCalendar();
    // Wait for the grid to render with day buttons
    await waitFor(() => {
      const dayButtons = screen.getAllByRole('button', { name: /2026-06-\d\d/ });
      expect(dayButtons.length).toBeGreaterThanOrEqual(28);
    });

    // Day numbers 1–30 should be visible somewhere
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
    expect(screen.getByText('30')).toBeDefined();
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

    // The SVG should have a sport attribute indicating the sport type
    const svg = svgs[0];
    expect(svg.getAttribute('data-sport')).toBeTruthy();
    expect(svg.getAttribute('data-sport')).not.toBe(''); // must be a named sport, not empty
  });

  it('(c) selecting a day shows its agenda list', async () => {
    renderCalendar();

    // Wait for grid to render
    await waitFor(() => {
      screen.getAllByRole('button', { name: /2026-06-26/ });
    });

    // Click on June 26
    const june26Button = screen.getByRole('button', { name: /2026-06-26/ });
    fireEvent.click(june26Button);

    // Agenda should show the event for June 26
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
      screen.getAllByRole('button', { name: /2026-06-26/ });
    });

    // Select June 26 to load the agenda
    const june26Button = screen.getByRole('button', { name: /2026-06-26/ });
    fireEvent.click(june26Button);

    // Wait for agenda to render
    await waitFor(() => screen.getAllByTestId('agenda-event-row'));

    // Click the event row button (it's inside the li)
    const eventButton = screen.getByRole('button', { name: /Threshold Intervals/ });
    fireEvent.click(eventButton);

    // Should navigate to /workout/101
    await waitFor(() => {
      expect(screen.getByTestId('workout-page')).toBeDefined();
    });
  });

  it('renders header with month name and navigation buttons', async () => {
    renderCalendar();
    // Header renders immediately (no async needed)
    expect(screen.getByText(/June 2026/)).toBeDefined();
    expect(screen.getByRole('button', { name: /previous month/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /next month/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /add workout/i })).toBeDefined();
  });

  it('renders empty month with no event indicators when API returns []', async () => {
    mockGetEvents.mockResolvedValue([]);
    renderCalendar();
    // Wait for grid to render (no skeleton)
    await waitFor(() => {
      screen.getAllByRole('button', { name: /2026-06-\d\d/ });
    });

    // No glyph indicators
    expect(screen.queryAllByTestId('sport-glyph-indicator')).toHaveLength(0);
  });
});
