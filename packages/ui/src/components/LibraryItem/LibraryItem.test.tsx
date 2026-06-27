import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LibraryItem } from './LibraryItem';
import { ZONE_COLORS } from '../../lib/zones';

expect.extend(toHaveNoViolations);

const base = {
  name: 'Spencer +2',
  tss: 98,
  intervalCount: 6,
  durationSecs: 4500,
  primaryZone: 4 as const,
};

describe('LibraryItem', () => {
  it('renders name and meta line', () => {
    render(<LibraryItem {...base} />);
    expect(screen.getByText('Spencer +2')).toBeInTheDocument();
    expect(screen.getByText(/6 intervals/)).toBeInTheDocument();
    // Duration shows in the meta line and the right rail.
    expect(screen.getAllByText(/1h 15m/).length).toBeGreaterThan(0);
  });

  it('uses the primary zone color for the left border', () => {
    const { container } = render(<LibraryItem {...base} />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.borderLeftColor).toBeTruthy();
    // jsdom normalizes hex to rgb; assert the token is wired, not a literal hex.
    expect(ZONE_COLORS[4]).toBe('#ef4444');
  });

  it('renders one ZoneBadge per zone', () => {
    render(<LibraryItem {...base} zones={[4, 5]} />);
    expect(screen.getByText('VO2max')).toBeInTheDocument();
    expect(screen.getByText('Anaerobic')).toBeInTheDocument();
  });

  it('falls back to the primary zone badge when zones absent', () => {
    render(<LibraryItem {...base} />);
    expect(screen.getByText('VO2max')).toBeInTheDocument();
  });

  it('renders an AdaptiveBadge when intensityFactor given', () => {
    render(<LibraryItem {...base} intensityFactor={1.02} />);
    expect(screen.getByText('Breakthrough')).toBeInTheDocument();
  });

  it('fires onClick and renders as a button', () => {
    const onClick = vi.fn();
    render(<LibraryItem {...base} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spencer +2' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <LibraryItem {...base} zones={[4, 5]} intensityFactor={1.02} onClick={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
