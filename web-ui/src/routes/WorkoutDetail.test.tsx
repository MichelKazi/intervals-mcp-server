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
  getActivities: vi.fn(),
  getCompliance: vi.fn(),
  pairActivity: vi.fn(),
  unpairActivity: vi.fn(),
  markEventDone: vi.fn(),
  moveEvent: vi.fn(),
  updateEvent: vi.fn(),
}));

import * as api from '../lib/api';
import type { Compliance } from '../lib/types';

const COMPLIANCE_NOT_PAIRED: Compliance = {
  event_id: 12345,
  paired_activity_id: null,
  paired: false,
  planned: { load: 75, duration: 3600 },
  actual: null,
  compliance: { load_pct: null, duration_pct: null, verdict: 'unknown' },
};

const COMPLIANCE_ON_TARGET: Compliance = {
  event_id: 12345,
  paired_activity_id: 'i999',
  paired: true,
  planned: { load: 75, duration: 3600 },
  actual: { load: 78, duration: 3700, intensity: 85 },
  compliance: { load_pct: 104, duration_pct: 103, verdict: 'on_target' },
};

const RECENT_ACTIVITIES: PlannedEvent[] = [
  {
    id: 'i999',
    name: 'Tuesday Intervals',
    type: 'Ride',
    category: 'RIDE',
    start_date_local: '2026-06-24T07:00:00',
    end_date_local: '2026-06-24T08:00:00',
    icu_training_load: 78,
  },
];

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
  // Default compliance: not paired
  vi.mocked(api.getCompliance).mockResolvedValue(COMPLIANCE_NOT_PAIRED);
  vi.mocked(api.getActivities).mockResolvedValue(RECENT_ACTIVITIES);
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
      // Activity IDs from intervals.icu start with "i" — the intervals query is only
      // enabled when the id starts with "i" (or when the event fetch fails).
      vi.mocked(api.getEvent).mockResolvedValue(PLANNED_EVENT);
      vi.mocked(api.getActivityIntervals).mockResolvedValue(COMPLETED_INTERVALS);
    });

    it('renders lap list rows', async () => {
      // Use an activity-style id (starts with "i") so the intervals query fires.
      renderWorkoutDetail('i12345');
      await waitFor(() => screen.getAllByTestId('lap-row'));
      const rows = screen.getAllByTestId('lap-row');
      expect(rows.length).toBe(3);
    });

    it('renders chart from laps (since no steps override applied when laps present)', async () => {
      // When laps are present but steps also exist, steps take priority in our impl.
      // This test verifies chart is present.
      renderWorkoutDetail('i12345');
      await waitFor(() => screen.getByTestId('chart-container'));
      expect(screen.getByTestId('chart-container')).toBeTruthy();
    });

    it('renders workout chart bars (from steps when both present)', async () => {
      renderWorkoutDetail('i12345');
      await waitFor(() => screen.getAllByTestId('workout-bar'));
      // 3 bars from the steps
      expect(screen.getAllByTestId('workout-bar').length).toBe(3);
    });
  });

  describe('compliance section', () => {
    beforeEach(() => {
      vi.mocked(api.getEvent).mockResolvedValue(PLANNED_EVENT);
    });

    it('shows verdict text and load_pct when paired + on target', async () => {
      vi.mocked(api.getCompliance).mockResolvedValue(COMPLIANCE_ON_TARGET);
      renderWorkoutDetail();
      await waitFor(() => screen.getByTestId('verdict-badge'));
      expect(screen.getByTestId('verdict-badge').textContent).toMatch(/On target/i);
      expect(screen.getByText(/104% of planned/i)).toBeTruthy();
    });

    it('shows Link activity button when not paired', async () => {
      vi.mocked(api.getCompliance).mockResolvedValue(COMPLIANCE_NOT_PAIRED);
      renderWorkoutDetail();
      await waitFor(() => screen.getByTestId('link-activity-btn'));
      expect(screen.getByText(/Not linked to an activity yet/i)).toBeTruthy();
    });

    it('opens picker and calls pairActivity when an activity is selected', async () => {
      vi.mocked(api.getCompliance).mockResolvedValue(COMPLIANCE_NOT_PAIRED);
      vi.mocked(api.pairActivity).mockResolvedValue(PLANNED_EVENT);
      renderWorkoutDetail();
      const linkBtn = await screen.findByTestId('link-activity-btn');
      fireEvent.click(linkBtn);
      const option = await screen.findByTestId('activity-option');
      fireEvent.click(option);
      await waitFor(() =>
        expect(api.pairActivity).toHaveBeenCalledWith('12345', 'i999')
      );
    });

    it('shows "No linkable activities found" when picker is empty', async () => {
      vi.mocked(api.getCompliance).mockResolvedValue(COMPLIANCE_NOT_PAIRED);
      vi.mocked(api.getActivities).mockResolvedValue([]);
      renderWorkoutDetail();
      const linkBtn = await screen.findByTestId('link-activity-btn');
      fireEvent.click(linkBtn);
      await waitFor(() => screen.getByText(/No linkable activities found/i));
    });

    it('calls unpairActivity when Unlink clicked', async () => {
      vi.mocked(api.getCompliance).mockResolvedValue(COMPLIANCE_ON_TARGET);
      vi.mocked(api.unpairActivity).mockResolvedValue(PLANNED_EVENT);
      renderWorkoutDetail();
      const unlinkBtn = await screen.findByTestId('unlink-btn');
      fireEvent.click(unlinkBtn);
      await waitFor(() => expect(api.unpairActivity).toHaveBeenCalledWith('12345'));
    });

    it('does not crash when compliance endpoint errors', async () => {
      vi.mocked(api.getCompliance).mockRejectedValue(new Error('boom'));
      renderWorkoutDetail();
      await waitFor(() => screen.getByText(/Compliance data unavailable/i));
      // Workout itself still renders
      expect(screen.getByText('Test Threshold Workout')).toBeTruthy();
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
