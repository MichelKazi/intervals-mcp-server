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
  postCommand: vi.fn(),
  executeCommand: vi.fn(),
  getProfile: vi.fn(),
  updateProfileCore: vi.fn(),
  updateProfileContext: vi.fn(),
  addMedication: vi.fn(),
  removeMedication: vi.fn(),
}));

import {
  callMcp, getWellness, getActivities, getCoachingState, getCoachingBrief, analyzeActivity,
  postCommand, executeCommand,
  getProfile, updateProfileCore, updateProfileContext, addMedication, removeMedication,
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
const mockPostCommand = vi.mocked(postCommand);
const mockExecuteCommand = vi.mocked(executeCommand);
const mockGetProfile = vi.mocked(getProfile);
const mockUpdateProfileCore = vi.mocked(updateProfileCore);
const mockUpdateProfileContext = vi.mocked(updateProfileContext);
const mockAddMedication = vi.mocked(addMedication);
const mockRemoveMedication = vi.mocked(removeMedication);
void mockGetCoachingState;
void mockGetCoachingBrief;
void mockAnalyzeActivity;
void mockGetActivities;

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

const PROFILE = {
  athlete: {
    athlete_id: 'i334094',
    name: 'Michelkazi',
    birth_date: null,
    weight_kg: 83,
    sex: 'M',
    gender_identity: null,
    location: 'Denver, United States',
    timezone: 'America/Denver',
  },
  context: {
    athlete_id: 'i334094',
    job_type: 'sedentary_desk',
    job_notes: null,
    free_time: { mon: 1, tue: 0.5 },
    mood: 'energized',
    motivation_score: 7,
    additional_notes: null,
    mesocycle_preference: '2+1',
    training_history_notes: 'Strong threshold base, limited VO2max.',
    dropout_risk: 'Low; consistent week to week.',
    coach_read_refreshed_at: '2026-06-20T09:00:00Z',
    use_medical: true,
    use_lifestyle: true,
    use_psychological: true,
    profile_skill_md: null,
  },
  medications: [
    { id: 'med-1', name: 'tirzepatide', drug_class: 'GLP1', schedule_weekday: 3, notes: null, active: true },
  ],
};

describe('Settings', () => {
  beforeEach(() => {
    mockGetProfile.mockResolvedValue(PROFILE as never);
    mockUpdateProfileCore.mockResolvedValue(PROFILE as never);
    mockUpdateProfileContext.mockResolvedValue(PROFILE as never);
    mockAddMedication.mockResolvedValue(PROFILE as never);
    mockRemoveMedication.mockResolvedValue(PROFILE as never);
  });

  it('renders profile fields and online server status', async () => {
    renderScreen(<Settings />);
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Michelkazi'));
    expect(screen.getByLabelText('Weight (kg)')).toHaveValue(83);
    await waitFor(() => expect(screen.getByTestId('server-status')).toHaveTextContent('Online'));
  });

  it('editing a demographic field calls updateProfileCore on blur', async () => {
    renderScreen(<Settings />);
    const name = await screen.findByLabelText('Name');
    fireEvent.change(name, { target: { value: 'New Name' } });
    fireEvent.blur(name);
    await waitFor(() => expect(mockUpdateProfileCore).toHaveBeenCalledWith({ name: 'New Name' }));
  });

  it('toggling a consent switch calls updateProfileContext', async () => {
    renderScreen(<Settings />);
    const toggle = await screen.findByLabelText('Let the coach use medical info');
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    fireEvent.click(toggle);
    await waitFor(() => expect(mockUpdateProfileContext).toHaveBeenCalledWith({ use_medical: false }));
  });

  it('adding a medication calls addMedication with the form values', async () => {
    renderScreen(<Settings />);
    const nameInput = await screen.findByLabelText('Medication name');
    fireEvent.change(nameInput, { target: { value: 'caffeine' } });
    fireEvent.change(screen.getByLabelText('Drug class'), { target: { value: 'stimulant' } });
    fireEvent.click(screen.getByTestId('add-med'));
    await waitFor(() =>
      expect(mockAddMedication).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'caffeine', drug_class: 'stimulant' }),
      ),
    );
  });

  it('removing a medication calls removeMedication with the id', async () => {
    renderScreen(<Settings />);
    const removeBtn = await screen.findByLabelText('Remove tirzepatide');
    fireEvent.click(removeBtn);
    await waitFor(() => expect(mockRemoveMedication).toHaveBeenCalledWith('med-1'));
  });

  it('shows the current mood and picking a new one PUTs the key', async () => {
    renderScreen(<Settings />);
    const trigger = await screen.findByLabelText('Mood');
    await waitFor(() => expect(trigger).toHaveTextContent('Energized'));
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Tired' }));
    await waitFor(() => expect(mockUpdateProfileContext).toHaveBeenCalledWith({ mood: 'tired' }));
  });

  it('moving the motivation slider PUTs motivation_score', async () => {
    renderScreen(<Settings />);
    const slider = await screen.findByLabelText('Motivation');
    await waitFor(() => expect(slider).toHaveValue('7'));
    fireEvent.change(slider, { target: { value: '3' } });
    await waitFor(() =>
      expect(mockUpdateProfileContext).toHaveBeenCalledWith({ motivation_score: 3 }),
    );
  });

  it('changing a free-time day PUTs the full weekday map', async () => {
    renderScreen(<Settings />);
    const cell = await screen.findByLabelText('Wed 2');
    fireEvent.click(cell);
    await waitFor(() =>
      expect(mockUpdateProfileContext).toHaveBeenCalledWith({
        free_time: { mon: 1, tue: 0.5, wed: 2, thu: 0, fri: 0, sat: 0, sun: 0 },
      }),
    );
  });

  it('committing notes on blur PUTs additional_notes', async () => {
    renderScreen(<Settings />);
    const notes = await screen.findByLabelText('Notes for the coach');
    fireEvent.change(notes, { target: { value: 'Traveling next week.' } });
    fireEvent.blur(notes);
    await waitFor(() =>
      expect(mockUpdateProfileContext).toHaveBeenCalledWith({
        additional_notes: 'Traveling next week.',
      }),
    );
  });

  it('renders the read-only coach read with both derived sections', async () => {
    renderScreen(<Settings />);
    const card = await screen.findByLabelText('Coach read');
    expect(card).toHaveTextContent('Strong threshold base');
    fireEvent.click(card);
    expect(screen.getByText('Training history')).toBeInTheDocument();
    expect(screen.getByText('Adherence pattern')).toBeInTheDocument();
  });

  it('does not offer editable training-history or dropout inputs', async () => {
    renderScreen(<Settings />);
    await screen.findByLabelText('Mood');
    expect(screen.queryByLabelText('Training history')).toBeNull();
    expect(screen.queryByLabelText('Dropout risk')).toBeNull();
  });

  it('consent switch reflects the on/off state via aria-checked', async () => {
    renderScreen(<Settings />);
    const medical = await screen.findByLabelText('Let the coach use medical info');
    await waitFor(() => expect(medical).toHaveAttribute('aria-checked', 'true'));
    fireEvent.click(medical);
    await waitFor(() =>
      expect(mockUpdateProfileContext).toHaveBeenCalledWith({ use_medical: false }),
    );
  });
});

describe('CoachingChat (command bar)', () => {
  it('submitting a read command renders a result card', async () => {
    mockPostCommand.mockResolvedValue({
      summary: 'Overview',
      executed: true,
      results: [{ tool: 'get_dashboard', ok: true, summary: 'Next workout: Threshold.' }],
    } as never);
    renderScreen(<CoachingChat />);

    fireEvent.click(screen.getByText("How's my training?"));

    await waitFor(() => expect(mockPostCommand).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('entry-result')).toBeInTheDocument());
    expect(screen.getByText('Next workout: Threshold.')).toBeInTheDocument();
  });

  it('submitting a write command shows a confirm card without executing', async () => {
    const actions = [{ tool: 'create_time_off', args: { start_date: '2026-06-29' }, kind: 'write' as const }];
    mockPostCommand.mockResolvedValue({
      summary: 'Block holiday time off on 2026-06-29',
      executed: false,
      needs_confirm: true,
      proposed_actions: actions,
      actions,
    } as never);
    renderScreen(<CoachingChat />);

    fireEvent.click(screen.getByText('Time off this week'));

    await waitFor(() => expect(screen.getByTestId('entry-confirm')).toBeInTheDocument());
    expect(screen.getByText(/Block holiday time off/)).toBeInTheDocument();
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('confirming a write executes the actions and shows the result', async () => {
    const actions = [{ tool: 'create_time_off', args: { start_date: '2026-06-29' }, kind: 'write' as const }];
    mockPostCommand.mockResolvedValue({
      summary: 'Block holiday time off on 2026-06-29',
      executed: false,
      needs_confirm: true,
      proposed_actions: actions,
      actions,
    } as never);
    mockExecuteCommand.mockResolvedValue({
      executed: true,
      results: [{ tool: 'create_time_off', ok: true, summary: 'Time off created (2026-06-29).' }],
    } as never);
    renderScreen(<CoachingChat />);

    fireEvent.click(screen.getByText('Time off this week'));
    await waitFor(() => expect(screen.getByTestId('confirm-btn')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => expect(mockExecuteCommand).toHaveBeenCalledWith(actions));
    await waitFor(() => expect(screen.getByText('Time off created (2026-06-29).')).toBeInTheDocument());
  });
});
