import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ContributorRow } from './ContributorRow';
import tokens from '../../tokens/generated/tokens';

expect.extend(toHaveNoViolations);

const violet = tokens.color.accent.primary;

describe('ContributorRow', () => {
  it('renders label and rounded value', () => {
    render(<ContributorRow label="Sleep" value={78.6} color={violet} />);
    expect(screen.getByText('Sleep')).toBeInTheDocument();
    expect(screen.getByText('79')).toBeInTheDocument();
  });

  it('renders displayValue instead of raw score', () => {
    render(<ContributorRow label="HRV" value={64} displayValue="57ms" color={violet} />);
    expect(screen.getByText('57ms')).toBeInTheDocument();
    expect(screen.queryByText('64')).not.toBeInTheDocument();
  });

  it.each([
    ['up', '↑', 'trending up'],
    ['down', '↓', 'trending down'],
    ['flat', '→', 'trending flat'],
  ] as const)('renders %s trend arrow', (trend, glyph, label) => {
    render(<ContributorRow label="X" value={50} trend={trend} color={violet} />);
    const arrow = screen.getByLabelText(label);
    expect(arrow).toHaveTextContent(glyph);
  });

  it('progressbar has clamped aria attributes', () => {
    render(<ContributorRow label="Load" value={150} color={violet} />);
    const bar = screen.getByRole('progressbar', { name: 'Load' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <ContributorRow label="Sleep" value={78} displayValue="6.4h" trend="up" color={violet} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
