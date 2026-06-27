import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AdaptiveBadge } from './AdaptiveBadge';
import tokens from '../../tokens/generated/tokens';

expect.extend(toHaveNoViolations);

const { zone, status } = tokens.color;

describe('AdaptiveBadge', () => {
  it('renders the derived label', () => {
    render(<AdaptiveBadge intensityFactor={0.6} />);
    expect(screen.getByText('Recovery')).toBeInTheDocument();
  });

  it.each([
    [0.0, 'Recovery', zone['1']],
    [0.74, 'Recovery', zone['1']],
    [0.75, 'Achievable', status.good],
    [0.84, 'Achievable', status.good],
    [0.85, 'Productive', zone['1']],
    [0.94, 'Productive', zone['1']],
    [0.95, 'Stretch', status.caution],
    [1.0, 'Stretch', status.caution],
    [1.01, 'Breakthrough', status.danger],
    [1.3, 'Breakthrough', status.danger],
  ])('IF %s → %s', (ifValue, label, color) => {
    render(<AdaptiveBadge intensityFactor={ifValue} />);
    const pill = screen.getByText(label);
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveStyle({ color, backgroundColor: `${color}26` });
  });

  it('defaults to sm padding, applies md when requested', () => {
    const { rerender } = render(<AdaptiveBadge intensityFactor={0.9} />);
    expect(screen.getByText('Productive')).toHaveClass('px-2', 'py-0.5');
    rerender(<AdaptiveBadge intensityFactor={0.9} size="md" />);
    expect(screen.getByText('Productive')).toHaveClass('px-3', 'py-1');
  });

  it('omits title unless showTooltip is set', () => {
    const { rerender } = render(<AdaptiveBadge intensityFactor={0.98} />);
    expect(screen.getByText('Stretch')).not.toHaveAttribute('title');
    rerender(<AdaptiveBadge intensityFactor={0.98} showTooltip />);
    expect(screen.getByText('Stretch')).toHaveAttribute(
      'title',
      expect.stringContaining('Stretch'),
    );
  });

  it('forwards className', () => {
    render(<AdaptiveBadge intensityFactor={0.5} className="custom-x" />);
    expect(screen.getByText('Recovery')).toHaveClass('custom-x');
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <AdaptiveBadge intensityFactor={0.98} showTooltip />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
