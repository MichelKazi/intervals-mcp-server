import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CalendarWeekStrip } from './CalendarWeekStrip';
import type { CalendarDay } from './CalendarWeekStrip.types';

expect.extend(toHaveNoViolations);

// Local-time dates (month is 0-indexed) so getDate()/getDay() are TZ-stable.
const week: CalendarDay[] = [
  { date: new Date(2026, 5, 22), plannedTSS: 60, actualTSS: 58, zone: 2 },
  { date: new Date(2026, 5, 23), plannedTSS: 95, actualTSS: 92, zone: 4, isHardDay: true },
  { date: new Date(2026, 5, 24), plannedTSS: 0, actualTSS: 0 },
  { date: new Date(2026, 5, 25), plannedTSS: 78, actualTSS: 50, zone: 3 },
  { date: new Date(2026, 5, 26), plannedTSS: 45, actualTSS: 0, zone: 1, isToday: true },
  { date: new Date(2026, 5, 27), plannedTSS: 120, actualTSS: 0, zone: 5, isRace: true },
  { date: new Date(2026, 5, 28), plannedTSS: 140, actualTSS: 0, zone: 5, isArace: true },
];

describe('CalendarWeekStrip', () => {
  it('renders 7 columns when selectable', () => {
    render(<CalendarWeekStrip days={week} onSelectDate={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('marks today with aria-current', () => {
    render(<CalendarWeekStrip days={week} onSelectDate={() => {}} />);
    const today = screen.getByRole('button', { name: /today/i });
    expect(today).toHaveAttribute('aria-current', 'date');
  });

  it('applies a left border on hard days', () => {
    render(<CalendarWeekStrip days={week} onSelectDate={() => {}} />);
    const hard = screen.getByRole('button', { name: /hard day/i });
    expect(hard.className).toContain('border-l-2');
  });

  it('renders a crown for the A-race day', () => {
    render(<CalendarWeekStrip days={week} onSelectDate={() => {}} />);
    expect(screen.getByText('👑')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /A-race/i })).toBeInTheDocument();
  });

  it('fires onSelectDate with the column date on click', () => {
    const onSelectDate = vi.fn();
    render(<CalendarWeekStrip days={week} onSelectDate={onSelectDate} />);
    fireEvent.click(screen.getByRole('button', { name: /today/i }));
    expect(onSelectDate).toHaveBeenCalledOnce();
    expect((onSelectDate.mock.calls[0][0] as Date).getDate()).toBe(26);
  });

  it('renders static columns without onSelectDate', () => {
    render(<CalendarWeekStrip days={week} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <CalendarWeekStrip days={week} selectedDate={week[3].date} onSelectDate={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
