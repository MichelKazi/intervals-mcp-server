import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MetricRing } from './MetricRing';
import tokens from '../../tokens/generated/tokens';
import type { ContributorRowProps } from '../ContributorRow';

expect.extend(toHaveNoViolations);

const contributors: ContributorRowProps[] = [
  { label: 'Sleep', value: 82, displayValue: '7.1h', color: tokens.color.status.good },
  { label: 'HRV', value: 64, displayValue: '57ms', color: tokens.color.accent.primary },
];

describe('MetricRing', () => {
  it('renders value, statusWord, and meaning', () => {
    render(
      <MetricRing
        value={78}
        status="good"
        statusWord="READY"
        meaning="Go hard today."
        label="READINESS"
        animated={false}
      />,
    );
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByText('Go hard today.')).toBeInTheDocument();
  });

  it('throws when meaning is empty', () => {
    expect(() =>
      render(<MetricRing value={50} status="good" statusWord="OK" meaning="" />),
    ).toThrow(/meaning is required/);
  });

  it('clamps value above max', () => {
    render(
      <MetricRing value={150} max={100} status="good" statusWord="MAX" meaning="Clamped." animated={false} />,
    );
    expect(screen.getByText('100')).toBeInTheDocument();
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders a ConfoundPill when confound is set', () => {
    render(
      <MetricRing
        value={60}
        status="caution"
        statusWord="EASY"
        meaning="Watch it."
        confound="💉 Dose day"
        animated={false}
      />,
    );
    expect(screen.getByText('💉 Dose day')).toBeInTheDocument();
  });

  it('omits the confound pill when absent', () => {
    render(<MetricRing value={60} status="good" statusWord="OK" meaning="Fine." animated={false} />);
    expect(screen.queryByText(/Dose day/)).not.toBeInTheDocument();
  });

  it('meter has correct aria attributes', () => {
    render(
      <MetricRing value={40} max={80} status="good" statusWord="OK" meaning="Fine." label="LOAD" animated={false} />,
    );
    const meter = screen.getByRole('meter', { name: 'LOAD' });
    expect(meter).toHaveAttribute('aria-valuenow', '40');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '80');
  });

  it('expandable hides contributors until clicked', async () => {
    const user = userEvent.setup();
    render(
      <MetricRing
        value={78}
        status="good"
        statusWord="READY"
        meaning="Go."
        label="READINESS"
        contributors={contributors}
        expandable
        animated={false}
      />,
    );
    expect(screen.queryByText('7.1h')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /READINESS details/ }));
    expect(screen.getByText('7.1h')).toBeInTheDocument();
  });

  it('renders contributors inline when not expandable', () => {
    render(
      <MetricRing
        value={78}
        status="good"
        statusWord="READY"
        meaning="Go."
        contributors={contributors}
        animated={false}
      />,
    );
    expect(screen.getByText('7.1h')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <MetricRing
        value={78}
        status="good"
        statusWord="READY"
        meaning="Go hard today."
        label="READINESS"
        animated={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
