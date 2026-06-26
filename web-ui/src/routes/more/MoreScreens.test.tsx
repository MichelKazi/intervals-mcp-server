import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

vi.mock('@/lib/api', () => ({
  callMcp: vi.fn(),
  getWellness: vi.fn(),
  getActivities: vi.fn(),
  getCoachingState: vi.fn(),
  getCoachingBrief: vi.fn(),
  analyzeActivity: vi.fn(),
}));

import {
  callMcp, getWellness, getActivities, getCoachingState, getCoachingBrief, analyzeActivity,
} from '@/lib/api';
import PlannedVsActual from './PlannedVsActual';
import Polarization from './Polarization';
import WorkoutBuilder from './WorkoutBuilder';
import CoachingChat from './CoachingChat';
import DoseLog from './DoseLog';
import FieldTest from './FieldTest';
import Settings from './Settings';

const mockCallMcp = vi.mocked(callMcp);
const mockGetWellness = vi.mocked(getWellness);
const mockGetActivities = vi.mocked(getActivities);
const mockGetCoachingState = vi.mocked(getCoachingState);
const mockGetCoachingBrief = vi.mocked(getCoachingBrief);
const mockAnalyzeActivity = vi.mocked(analyzeActivity);

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const PVA_TEXT = `Planned vs Actual (2026-06-19 to 2026-06-26):
  ✓ 2026-06-19 Knocknam — duration: 2h49m/1h30m (188%), load: 117/107 (109%)
  ✗ 2026-06-21 Solo Ride — MISSED
  ✓ 2026-06-23 Brasted (3x13) — duration: 1h20m/55m (145%), load: 67/73 (92%)`;

const INSIGHTS_TEXT = `Training Insights:
  Aerobic Efficiency:
    2026-05-18: Pwr:HR=1.13 | EF=1.44 | Decouple=9.5%
    2026-06-22: Pwr:HR=0.94 | EF=1.51 | Decouple=41.5%`;

const ATHLETE_TEXT = 'Athlete Profile:\n\nName: Michelkazi\nCity: Denver\nSport Settings:\n  - Unknown | FTP: 290W | LTHR: 172bpm';

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', version: '0.1.1' }) }) as never;
});

describe('PlannedVsActual', () => {
  it('renders parsed plan items', async () => {
    mockCallMcp.mockResolvedValue({ result: PVA_TEXT });
    renderScreen(<PlannedVsActual />);
    await waitFor(() => expect(screen.getByText('Knocknam')).toBeInTheDocument());
    expect(screen.getAllByTestId('plan-item').length).toBe(3);
    expect(screen.getByText('Unlogged')).toBeInTheDocument();
  });
});

describe('Polarization', () => {
  it('renders zone bands and a Z2 status card', async () => {
    mockCallMcp.mockResolvedValue({ result: INSIGHTS_TEXT });
    renderScreen(<Polarization />);
    await waitFor(() => expect(screen.getByTestId('zone-z2')).toBeInTheDocument());
  });
});

describe('WorkoutBuilder', () => {
  it('renders coming soon', () => {
    renderScreen(<WorkoutBuilder />);
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
  });
});

describe('DoseLog', () => {
  it('renders dose rows parsed from comments', async () => {
    mockGetWellness.mockResolvedValue([
      { id: '2026-06-25', comments: 'Tirzepatide 60 units (0.60ml) — held.', hrv: 36 },
      { id: '2026-06-18', comments: 'Tirzepatide 75 units (0.75ml).', hrv: 21 },
    ] as never);
    renderScreen(<DoseLog />);
    await waitFor(() => expect(screen.getAllByTestId('dose-row').length).toBe(2));
    expect(screen.getByText('Medical Log')).toBeInTheDocument();
  });
});

describe('FieldTest', () => {
  it('recommends a test and schedules on click', async () => {
    mockCallMcp.mockImplementation((tool: string) => {
      if (tool === 'get_athlete') return Promise.resolve({ result: ATHLETE_TEXT });
      return Promise.resolve({ result: 'ok' });
    });
    mockGetWellness.mockResolvedValue([{ id: '2026-06-25', ctl: 50 }] as never);
    renderScreen(<FieldTest />);
    await waitFor(() => expect(screen.getByText('Schedule Test')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Schedule Test'));
    await waitFor(() =>
      expect(mockCallMcp).toHaveBeenCalledWith('add_or_update_event', expect.objectContaining({ type: 'Ride' })),
    );
  });
});

describe('Settings', () => {
  it('renders profile and online server status', async () => {
    mockCallMcp.mockResolvedValue({ result: ATHLETE_TEXT });
    renderScreen(<Settings />);
    await waitFor(() => expect(screen.getByText('Michelkazi')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('server-status')).toHaveTextContent('Online'));
  });
});

describe('CoachingChat', () => {
  it('sends a quick prompt and renders a coach bubble from the api', async () => {
    mockGetCoachingState.mockResolvedValue({ result: 'State: green.' });
    mockGetCoachingBrief.mockResolvedValue({ result: "You're fresh. Train hard today." });
    renderScreen(<CoachingChat />);

    fireEvent.click(screen.getByText("How's my training?"));

    await waitFor(() => expect(mockGetCoachingBrief).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/You're fresh\. Train hard today\./)).toBeInTheDocument(),
    );
    // user bubble + coach bubble both present
    expect(screen.getByTestId('bubble-user')).toBeInTheDocument();
  });

  it('routes "Analyze last ride" through analyzeActivity', async () => {
    mockGetActivities.mockResolvedValue([{ id: 99, name: 'Knocknam' }] as never);
    mockAnalyzeActivity.mockResolvedValue({ result: 'Solid tempo ride.' });
    renderScreen(<CoachingChat />);

    fireEvent.click(screen.getByText('Analyze last ride'));

    await waitFor(() => expect(mockAnalyzeActivity).toHaveBeenCalledWith(99));
    await waitFor(() => expect(screen.getByText('Solid tempo ride.')).toBeInTheDocument());
  });
});
