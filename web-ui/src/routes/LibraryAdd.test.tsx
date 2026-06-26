import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import LibraryAdd from './LibraryAdd';
import * as api from '../lib/api';

vi.mock('../lib/api');

const mockWorkouts = [
  {
    tr_workout_id: 'w1',
    name: 'Antelope',
    duration_secs: 3600,
    tss: 67,
    zone_focus: ['sweet_spot'],
    interval_count: 5,
  },
  {
    tr_workout_id: 'w2',
    name: 'Baird',
    duration_secs: 3900,
    tss: 80,
    zone_focus: ['threshold'],
    interval_count: 3,
  },
];

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.mocked(api.searchLibrary).mockResolvedValue(mockWorkouts);
  vi.mocked(api.getAlternatives).mockResolvedValue([]);
  vi.mocked(api.createCustomWorkout).mockResolvedValue({});
  vi.mocked(api.createEvent).mockResolvedValue({
    id: 1,
    name: 'test',
    type: 'Ride',
    category: 'WORKOUT',
    start_date_local: '2026-01-01T00:00:00',
    end_date_local: '2026-01-01T01:00:00',
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LibraryAdd', () => {
  it('a. typing in search box calls searchLibrary after debounce', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { container } = render(<LibraryAdd />, { wrapper: makeWrapper() });

    // Wait for initial render and first query flush
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    vi.clearAllMocks();
    vi.mocked(api.searchLibrary).mockResolvedValue([]);

    const input = container.querySelector('input[type="search"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'threshold' } });

    // Debounce hasn't fired yet
    expect(api.searchLibrary).not.toHaveBeenCalled();

    // Advance past debounce (300ms)
    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    await waitFor(() => expect(api.searchLibrary).toHaveBeenCalled(), { timeout: 2000 });

    const calls = vi.mocked(api.searchLibrary).mock.calls;
    expect(calls[calls.length - 1][0]).toMatchObject({ name: 'threshold' });

    vi.useRealTimers();
  }, 10000);

  it('b. results list renders rows with name, duration, TSS', async () => {
    render(<LibraryAdd />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByText('Antelope')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText('Baird')).toBeInTheDocument();

    // Duration and TSS visible
    expect(screen.getByText('1h00m')).toBeInTheDocument();
    expect(screen.getByText(/67 TSS/)).toBeInTheDocument();
  });

  it('c. tapping a result row opens workout preview', async () => {
    render(<LibraryAdd />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByText('Antelope')).toBeInTheDocument(), { timeout: 3000 });

    fireEvent.click(screen.getByText('Antelope'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    }, { timeout: 2000 });

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Antelope');
  });

  it('d. selecting a date and clicking Add calls createCustomWorkout or createEvent with the schedule_date', async () => {
    render(<LibraryAdd />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByText('Antelope')).toBeInTheDocument(), { timeout: 3000 });

    fireEvent.click(screen.getByText('Antelope'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), { timeout: 2000 });

    const dateInput = screen.getByLabelText('Schedule date');
    fireEvent.change(dateInput, { target: { value: '2026-07-01' } });

    fireEvent.click(screen.getByRole('button', { name: /add to calendar/i }));

    await waitFor(() => {
      const customCalls = vi.mocked(api.createCustomWorkout).mock.calls;
      const eventCalls = vi.mocked(api.createEvent).mock.calls;
      const called = customCalls.length > 0 || eventCalls.length > 0;
      expect(called).toBe(true);
      if (customCalls.length > 0) {
        expect(JSON.stringify(customCalls[0][0])).toContain('2026-07-01');
      } else {
        expect(JSON.stringify(eventCalls[0][0])).toContain('2026-07-01');
      }
    }, { timeout: 3000 });
  });

  it('e. clicking "shorter" alternative chip calls getAlternatives with { adjustment: "shorter" }', async () => {
    render(<LibraryAdd />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByText('Antelope')).toBeInTheDocument(), { timeout: 3000 });

    fireEvent.click(screen.getByText('Antelope'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument(), { timeout: 2000 });

    const shorterBtn = screen.getByRole('button', { name: /shorter/i });
    fireEvent.click(shorterBtn);

    await waitFor(() => {
      expect(api.getAlternatives).toHaveBeenCalledWith(
        expect.objectContaining({ adjustment: 'shorter' })
      );
    }, { timeout: 3000 });
  });

  it('f. loading state shows skeleton with role="status"', async () => {
    // Make searchLibrary hang
    vi.mocked(api.searchLibrary).mockReturnValue(new Promise(() => {}));

    render(<LibraryAdd />, { wrapper: makeWrapper() });

    await waitFor(() => {
      const skeletons = screen.getAllByRole('status');
      expect(skeletons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('g. empty results shows "No workouts match — adjust filters."', async () => {
    vi.mocked(api.searchLibrary).mockResolvedValue([]);

    render(<LibraryAdd />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/No workouts match — adjust filters\./i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
