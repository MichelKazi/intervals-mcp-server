import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ActivityRow } from './ActivityRow';

expect.extend(toHaveNoViolations);

const base = { name: 'Threshold 3x12', date: 'Mon, Jun 23', durationSecs: 7080, tss: 92, zone: 3 } as const;

describe('ActivityRow', () => {
  it('renders name, formatted duration, and TSS', () => {
    render(<ActivityRow {...base} />);
    expect(screen.getByText('Threshold 3x12')).toBeInTheDocument();
    expect(screen.getByText('1h 58m · 92 TSS')).toBeInTheDocument();
  });

  it('formats sub-hour durations without hours', () => {
    render(<ActivityRow {...base} durationSecs={2700} />);
    expect(screen.getByText('45m · 92 TSS')).toBeInTheDocument();
  });

  it('renders RACE badge when isRace', () => {
    render(<ActivityRow {...base} isRace />);
    expect(screen.getByText('RACE')).toBeInTheDocument();
  });

  it('renders INTERVALS badge when isInterval', () => {
    render(<ActivityRow {...base} isInterval />);
    expect(screen.getByText('INTERVALS')).toBeInTheDocument();
  });

  it('race takes precedence over interval', () => {
    render(<ActivityRow {...base} isRace isInterval />);
    expect(screen.getByText('RACE')).toBeInTheDocument();
    expect(screen.queryByText('INTERVALS')).not.toBeInTheDocument();
  });

  it('renders distance when given', () => {
    render(<ActivityRow {...base} distanceM={32500} />);
    expect(screen.getByText('32.5 km')).toBeInTheDocument();
  });

  it('fires onClick and exposes name as the button label', async () => {
    const onClick = vi.fn();
    render(<ActivityRow {...base} onClick={onClick} />);
    const btn = screen.getByRole('button', { name: /Threshold 3x12/ });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<ActivityRow {...base} onClick={() => {}} distanceM={32500} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
