import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { LibraryTemplate } from './LibraryTemplate';

expect.extend(toHaveNoViolations);

describe('LibraryTemplate', () => {
  it('renders a chip per filterZone', () => {
    render(<LibraryTemplate filterZones={[1, 2, 3]} />);
    expect(screen.getByRole('button', { name: 'Endurance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tempo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Threshold' })).toBeInTheDocument();
  });

  it('defaults to all five zones', () => {
    render(<LibraryTemplate />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('marks active chips differently', () => {
    render(<LibraryTemplate filterZones={[1, 2]} activeZones={[1]} />);
    expect(screen.getByRole('button', { name: 'Endurance' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Tempo' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('fires onToggleZone with the zone on click', () => {
    const onToggleZone = vi.fn();
    render(<LibraryTemplate filterZones={[4]} onToggleZone={onToggleZone} />);
    fireEvent.click(screen.getByRole('button', { name: 'VO2max' }));
    expect(onToggleZone).toHaveBeenCalledWith(4);
  });

  it('renders search and items slots', () => {
    render(
      <LibraryTemplate search={<div data-testid="search" />} items={<div data-testid="items" />} />,
    );
    expect(screen.getByTestId('search')).toBeInTheDocument();
    expect(screen.getByTestId('items')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <LibraryTemplate
        search={<input aria-label="Search" />}
        activeZones={[3]}
        items={<div data-testid="items" />}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
