import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ReadinessCard } from './ReadinessCard';
import { ZONE_COLORS } from '../../lib/zones';

expect.extend(toHaveNoViolations);

const contributors = [
  { label: 'HRV', value: 82, displayValue: '68ms', color: ZONE_COLORS[1] },
  { label: 'Sleep', value: 71, displayValue: '6.4h', color: ZONE_COLORS[2] },
];

const base = {
  value: 84,
  status: 'caution' as const,
  statusWord: 'Moderate',
  meaning: 'Hold intensity steady.',
};

describe('ReadinessCard', () => {
  it('renders value, status word, and meaning', () => {
    render(<ReadinessCard {...base} />);
    expect(screen.getByText('84')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Hold intensity steady.')).toBeInTheDocument();
  });

  it('defaults the label to READINESS', () => {
    render(<ReadinessCard {...base} />);
    expect(screen.getByText('READINESS')).toBeInTheDocument();
  });

  it('renders the confound pill', () => {
    render(<ReadinessCard {...base} confound="Dose day" />);
    expect(screen.getByText('Dose day')).toBeInTheDocument();
  });

  it('expands contributors on click (collapsed by default)', () => {
    render(<ReadinessCard {...base} contributors={contributors} />);
    expect(screen.queryByText('HRV')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByText('HRV')).toBeInTheDocument();
    expect(screen.getByText('Sleep')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <ReadinessCard {...base} confound="Dose day" contributors={contributors} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
