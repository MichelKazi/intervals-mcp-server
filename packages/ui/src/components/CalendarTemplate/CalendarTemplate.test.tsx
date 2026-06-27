import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CalendarTemplate } from './CalendarTemplate';

expect.extend(toHaveNoViolations);

describe('CalendarTemplate', () => {
  it('renders the week/month toggle', () => {
    render(<CalendarTemplate />);
    expect(screen.getByRole('button', { name: 'week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'month' })).toBeInTheDocument();
  });

  it('marks the active view with aria-pressed', () => {
    render(<CalendarTemplate view="month" />);
    expect(screen.getByRole('button', { name: 'month' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'week' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('fires onViewChange on click', () => {
    const onViewChange = vi.fn();
    render(<CalendarTemplate view="week" onViewChange={onViewChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'month' }));
    expect(onViewChange).toHaveBeenCalledWith('month');
  });

  it('renders weekStrip and dayList slots', () => {
    render(
      <CalendarTemplate
        weekStrip={<div data-testid="strip" />}
        dayList={<div data-testid="day" />}
      />,
    );
    expect(screen.getByTestId('strip')).toBeInTheDocument();
    expect(screen.getByTestId('day')).toBeInTheDocument();
  });

  it('renders the drawer when provided', () => {
    render(<CalendarTemplate drawer={<div data-testid="drawer" />} />);
    expect(screen.getByTestId('drawer')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Details' })).toBeInTheDocument();
  });

  it('omits the drawer when absent', () => {
    render(<CalendarTemplate />);
    expect(screen.queryByRole('region', { name: 'Details' })).toBeNull();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <CalendarTemplate
        weekStrip={<div data-testid="strip" />}
        drawer={<div>Details</div>}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
