import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WorkoutDetail from './WorkoutDetail';
import type { PlannedEvent, ActivityIntervals } from '../lib/types';

// ── Mock api module ────────────────────────────────────────────────────────────

vi.mock('../lib/api', () => ({
  getEvent: vi.fn(),
  getActivity: vi.fn(),
  getActivityIntervals: vi.fn(),
  getAlternatives: vi.fn(),
  markEventDone: vi.fn(),
  moveEvent: vi.fn(),
  updateEvent: vi.fn(),
}));

import * as api from '../lib/api';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const PLANNED_EVENT: PlannedEvent = {
  id: 12345,
  name: 'Test Threshold Workout',
  type: 'Ride',
  category: 'WORKOUT',
  start_date_local: '2026-06-23T00:00:00',
  end_date_local: '2026-06-24T00:00:00',
  moving_time: 3600,
  icu_training_load: 75,
  icu_intensity: 85,
  description: 'A threshold workout description',
  workout_doc: {
    steps: [
      { duration: 600, power: { units: '%ftp', value: 55 } },
      { duration: 1800, power: { units: '%ftp', value: 95 } },
      { duration: 600, power: { units: '%ftp', value: 55 } },
    ],
  },
};

const COMPLETED_INTERVALS: ActivityIntervals = {
  icu_intervals: [
    {
      average_watts: 180,
      average_heartrate: 140,
      average_cadence: 88,
      moving_time: 600,
      label: 'Warmup',
    },
    {
      average_watts: 260,
      average_heartrate: 162,
      average_cadence: 92,
      moving_time: 1800,
      label: 'Main set',
    },
    {
      average_watts: 150,
      average_heartrate: 130,
      average_cadence: 80,
      moving_time: 600,
      label: 'Cooldown',
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWorkoutDetail(id = '12345') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/workout/${id}`]}>
        <Routes>
          <Route path="/workout/:id" element={<WorkoutDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: intervals returns empty
  vi.mocked(api.getActivityIntervals).mockResolvedValue({ icu_intervals: [] });
  // Default: activity fallback never called (event succeeds by default)
  vi.mocked(api.getActivity).mockResolvedValue(PLANNED_EVENT);
});

describe('WorkoutDetail', () => {
  describe('loading state', () => {
    it('shows skeleton while event is fetching', () => {
      vi.mocked(api.getEvent).mockReturnValue(new Promise(() => {})); // never resolves
      renderWorkoutDetail();
      // skeleton divs have animation style; just assert page doesn't crash and no workout name
      expect(screen.queryByText('Test Threshold Workout')).toBeNull();
    });
  });

  describe('planned workout (steps)', () => {
    beforeEach(() => {
      vi.mocked(api.getEvent).mockResolvedValue(PLANNED_EVENT);
    });

    it('renders WorkoutChart with bars from workout_doc.steps', async () => {
      renderWorkoutDetail();
      await waitFor(() => screen.getByTestId('chart-container'));
      const bars = screen.getAllByTestId('workout-bar');
      // 3 flat steps → 3 bars
      expect(bars.length).toBe(3);
    });

    it('chart container is present when data loads', async () => {
      renderWorkoutDetail();
      await waitFor(() => screen.getByTestId('chart-container'));
      expect(screen.getByTestId('chart-container')).toBeTruthy();
    });

    it('shows workout name in heading', async () => {
      renderWorkoutDetail();
      await waitFor(() => screen.getByText('Test Threshold Workout'));
    });

    it('shows Mark done button', async () => {
      renderWorkoutDetail();
      await waitFor(() => screen.getByTestId('mark-done-btn'));
    });

    it('"Mark done" button calls markEventDone with correct id', async () => {
      vi.mocked(api.markEventDone).mockResolvedValue(PLANNED_EVENT);
      renderWorkoutDetail();
      const btn = await screen.findByTestId('mark-done-btn');
      fireEvent.click(btn);
      await waitFor(() =>
        expect(api.markEventDone).toHaveBeenCalledWith(PLANNED_EVENT.id)
      );
    });

    it('reschedule via date input calls moveEvent', async () => {
      vi.mocked(api.moveEvent).mockResolvedValue(PLANNED_EVENT);
      renderWorkoutDetail();
      // Open reschedule
      const rescheduleBtn = await screen.findByTestId('reschedule-btn');
      fireEvent.click(rescheduleBtn);
      const dateInput = await screen.findByTestId('reschedule-date-input');
      fireEvent.change(dateInput, { target: { value: '2026-07-01' } });
      await waitFor(() =>
        expect(api.moveEvent).toHaveBeenCalledWith(PLANNED_EVENT.id, '2026-07-01')
      );
    });
  });

  describe('completed activity (laps)', () => {
    beforeEach(() => {
      vi.mocked(api.getEvent).mockResolvedValue(PLANNED_EVENT);
      vi.mocked(api.getActivityIntervals).mockResolvedValue(COMPLETED_INTERVALS);
    });

    it('renders lap list rows', async () => {
      renderWorkoutDetail();
      await waitFor(() => screen.getAllByTestId('lap-row'));
      const rows = screen.getAllByTestId('lap-row');
      expect(rows.length).toBe(3);
    });

    it('renders chart from laps (since no steps override applied when laps present)', async () => {
      // When laps are present but steps also exist, steps take priority in our impl.
      // This test verifies chart is present.
      renderWorkoutDetail();
      await waitFor(() => screen.getByTestId('chart-container'));
      expect(screen.getByTestId('chart-container')).toBeTruthy();
    });

    it('renders workout chart bars (from steps when both present)', async () => {
      renderWorkoutDetail();
      await waitFor(() => screen.getAllByTestId('workout-bar'));
      // 3 bars from the steps
      expect(screen.getAllByTestId('workout-bar').length).toBe(3);
    });
  });

  describe('error state', () => {
    it('shows error message and retry button on failure', async () => {
      vi.mocked(api.getEvent).mockRejectedValue(new Error('Not found'));
      vi.mocked(api.getActivity).mockRejectedValue(new Error('Not found'));
      vi.mocked(api.getActivityIntervals).mockRejectedValue(new Error('Not found'));
      renderWorkoutDetail();
      await waitFor(
        () => {
          const text = document.body.textContent ?? '';
          expect(text).toMatch(/Could not load workout/i);
        },
        { timeout: 4000 }
      );
      expect(screen.getByText(/Retry/i)).toBeTruthy();
    });
  });
});
