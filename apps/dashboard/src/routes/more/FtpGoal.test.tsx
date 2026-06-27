import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

vi.mock('@/lib/api', () => ({
  callMcp: vi.fn(),
  getWellness: vi.fn(),
  validateFtpGoal: vi.fn(),
  suggestPlanName: vi.fn(),
  savePlan: vi.fn(),
  getActivePlan: vi.fn(),
  archivePlan: vi.fn(),
}));

import {
  callMcp,
  getWellness,
  validateFtpGoal,
  suggestPlanName,
  savePlan,
  getActivePlan,
  archivePlan,
} from '@/lib/api';
import FtpGoal from './FtpGoal';

const mockCallMcp = vi.mocked(callMcp);
const mockGetWellness = vi.mocked(getWellness);
const mockValidate = vi.mocked(validateFtpGoal);
const mockSuggestName = vi.mocked(suggestPlanName);
const mockSavePlan = vi.mocked(savePlan);
const mockGetActivePlan = vi.mocked(getActivePlan);
const mockArchivePlan = vi.mocked(archivePlan);

const ATHLETE_TEXT =
  'Athlete Profile (i334094):\n\nName: Michelkazi\nSport Settings:\n  - Unknown | FTP: 290W | LTHR: 172bpm';

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCallMcp.mockImplementation((tool: string) => {
    if (tool === 'get_athlete') return Promise.resolve({ result: ATHLETE_TEXT });
    return Promise.resolve({ result: 'ok' });
  });
  mockGetWellness.mockResolvedValue([{ id: '2026-06-25', ctl: 48, atl: 50, readiness: 75 }] as never);
  mockValidate.mockResolvedValue({
    computed: {},
    coaching_note: 'A focused threshold block gets you there.',
    risk_factors: [],
    confidence_pct: 52,
  });
  mockSuggestName.mockResolvedValue({ name: 'Spring Threshold Build' });
  mockGetActivePlan.mockResolvedValue({ plan: null });
  mockSavePlan.mockResolvedValue({
    id: 'plan-1',
    name: 'Spring Threshold Build',
    goal: {},
    hard_weekdays: [1, 4],
    weeks: 8,
    start_date: '2026-06-29',
    skeleton: {},
    status: 'active',
  } as never);
  mockArchivePlan.mockResolvedValue({ archived: true });
});

describe('Plan Builder', () => {
  it('moving the slider updates the band instantly with no synchronous network call', async () => {
    renderScreen(<FtpGoal />);

    const slider = await screen.findByLabelText('Target FTP');
    fireEvent.change(slider, { target: { value: '305' } });

    // Band + numeric readout react synchronously.
    expect(screen.getByTestId('target-ftp')).toHaveTextContent('305W');
    const band = screen.getByTestId('validation-band');
    expect(band.getAttribute('data-achievability')).not.toBe('impossible');

    // No validate call fires synchronously during the drag.
    expect(mockValidate).not.toHaveBeenCalled();

    // It does fire after the debounce settles.
    await waitFor(() => expect(mockValidate).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('hard-day picker enforces 2–3 days and disables Thursday', async () => {
    renderScreen(<FtpGoal />);
    await screen.findByLabelText('Target FTP');

    const picker = screen.getByTestId('hard-days');
    const thu = within(picker).getByLabelText('Thu');
    expect(thu).toBeDisabled();

    // Default is 2 selected (Tue, Fri). Add a third (Mon) → 3 selected.
    const mon = within(picker).getByLabelText('Mon');
    fireEvent.click(mon);
    expect(mon).toHaveAttribute('aria-pressed', 'true');

    // A fourth selection is blocked: Wed stays unpressed.
    const wed = within(picker).getByLabelText('Wed');
    fireEvent.click(wed);
    expect(wed).toHaveAttribute('aria-pressed', 'false');

    // Deselecting down to the minimum is blocked: removing 3 leaves 2, but the
    // next removal is refused.
    fireEvent.click(mon); // back to 2
    const tue = within(picker).getByLabelText('Tue');
    const fri = within(picker).getByLabelText('Fri');
    fireEvent.click(tue);
    fireEvent.click(fri);
    // Still at least 2 selected.
    const pressed = within(picker)
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the calendar preview with day-type dots', async () => {
    renderScreen(<FtpGoal />);
    await screen.findByLabelText('Target FTP');
    const preview = await screen.findByTestId('calendar-preview');
    // Weekday letters and at least one labelled day dot.
    expect(within(preview).getAllByLabelText(/Hard|Endurance|Recovery|Rest/).length).toBeGreaterThan(0);
  });

  it('build calls savePlan then schedules a ride per non-rest day', async () => {
    renderScreen(<FtpGoal />);

    const slider = await screen.findByLabelText('Target FTP');
    fireEvent.change(slider, { target: { value: '305' } });

    const buildBtn = await screen.findByTestId('build-schedule');
    fireEvent.click(buildBtn);

    await waitFor(() => expect(mockSavePlan).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockCallMcp).toHaveBeenCalledWith(
        'add_or_update_event',
        expect.objectContaining({ type: 'Ride', description: expect.stringContaining('[plan:plan-1]') }),
      ),
    );
  });

  it('hard-rejects a goal at/below current FTP with zero validate calls', async () => {
    renderScreen(<FtpGoal />);
    const slider = await screen.findByLabelText('Target FTP');
    fireEvent.change(slider, { target: { value: '290' } });

    const band = screen.getByTestId('validation-band');
    expect(band).toHaveAttribute('data-achievability', 'impossible');
    expect(screen.queryByTestId('build-schedule')).not.toBeInTheDocument();
    // Give the debounce a chance — it must still not fire for an impossible goal.
    await new Promise((r) => setTimeout(r, 800));
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('shows an existing active plan at the top with adjustments', async () => {
    mockGetActivePlan.mockResolvedValue({
      plan: {
        id: 'plan-9',
        name: 'Existing Build',
        goal: { input: { targetFtp: 315 } },
        hard_weekdays: [1, 4],
        weeks: 6,
        start_date: '2026-06-01',
        skeleton: buildSampleSkeleton(),
        status: 'active',
      },
    } as never);

    renderScreen(<FtpGoal />);
    const card = await screen.findByTestId('active-plan');
    expect(within(card).getByText('Existing Build')).toBeInTheDocument();
    expect(within(card).getByText(/315W/)).toBeInTheDocument();
    expect(screen.getByTestId('active-plan-adjustments')).toBeInTheDocument();
  });
});

// Minimal valid skeleton so reconcilePlan doesn't crash on the active-plan path.
function buildSampleSkeleton() {
  return {
    weeks: [
      {
        weekNumber: 1,
        isRecoveryWeek: false,
        days: [
          { date: '2026-06-01', weekday: 0, type: 'rest', weekNumber: 1, isRecoveryWeek: false },
          { date: '2026-06-02', weekday: 1, type: 'hard', weekNumber: 1, isRecoveryWeek: false },
        ],
      },
    ],
    hardWeekdays: [1],
    spacingWarnings: [],
    injectionConflict: false,
    totalHardSessions: 1,
    startDate: '2026-06-01',
  };
}
