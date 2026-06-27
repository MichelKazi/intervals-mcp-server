import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

vi.mock('@/lib/api', () => ({
  callMcp: vi.fn(),
  getWellness: vi.fn(),
  validateFtpGoal: vi.fn(),
}));

import { callMcp, getWellness, validateFtpGoal } from '@/lib/api';
import FtpGoal from './FtpGoal';

const mockCallMcp = vi.mocked(callMcp);
const mockGetWellness = vi.mocked(getWellness);
const mockValidate = vi.mocked(validateFtpGoal);

const ATHLETE_TEXT =
  'Athlete Profile:\n\nName: Michelkazi\nSport Settings:\n  - Unknown | FTP: 290W | LTHR: 172bpm';

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
  mockGetWellness.mockResolvedValue([{ id: '2026-06-25', ctl: 48 }] as never);
});

describe('FtpGoal', () => {
  it('renders instant validation and enriches a valid goal without blocking', async () => {
    mockValidate.mockResolvedValue({
      computed: {},
      coaching_note: 'A focused threshold block gets you there.',
      risk_factors: ['Illness would cost a week of adaptation.'],
      confidence_pct: 50,
    });

    renderScreen(<FtpGoal />);

    // Type a valid target (310W, ~8 weeks out → aggressive). The band and the
    // deterministic confidence render synchronously, before any network resolves.
    const ftpInput = await screen.findByLabelText('Target FTP');
    fireEvent.change(ftpInput, { target: { value: '310' } });

    const band = screen.getByTestId('validation-band');
    expect(band).toHaveAttribute('data-achievability', 'aggressive');

    // LLM enrichment swaps in the coaching note, risk factors, and lowered confidence.
    await waitFor(() => expect(mockValidate).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId('coaching-note')).toHaveTextContent('focused threshold block'),
    );
    expect(screen.getByTestId('risk-factors')).toHaveTextContent('Illness');
    expect(screen.getByTestId('confidence')).toHaveTextContent('50%');
  });

  it('hard-rejects an impossible goal with zero network calls', async () => {
    renderScreen(<FtpGoal />);

    // Target below current FTP → deterministic reject, no schedule, no validate.
    const ftpInput = await screen.findByLabelText('Target FTP');
    fireEvent.change(ftpInput, { target: { value: '285' } });

    const band = await screen.findByTestId('validation-band');
    expect(band).toHaveAttribute('data-achievability', 'impossible');
    expect(screen.getByTestId('coaching-note')).toHaveTextContent(/current FTP/i);
    expect(screen.queryByText('Schedule FTP test')).not.toBeInTheDocument();
    expect(mockValidate).not.toHaveBeenCalled();
  });

  it('schedules an FTP test for a valid goal', async () => {
    mockValidate.mockResolvedValue({
      computed: {},
      coaching_note: 'Solid plan.',
      risk_factors: [],
      confidence_pct: 52,
    });

    renderScreen(<FtpGoal />);

    const ftpInput = await screen.findByLabelText('Target FTP');
    fireEvent.change(ftpInput, { target: { value: '310' } });

    const scheduleBtn = await screen.findByText('Schedule FTP test');
    fireEvent.click(scheduleBtn);

    await waitFor(() =>
      expect(mockCallMcp).toHaveBeenCalledWith(
        'add_or_update_event',
        expect.objectContaining({ name: 'FTP Test', type: 'Ride' }),
      ),
    );
  });
});
