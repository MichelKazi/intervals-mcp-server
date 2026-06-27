import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MetricValue } from './MetricValue';

expect.extend(toHaveNoViolations);

describe('MetricValue', () => {
  it('renders the value', () => {
    render(<MetricValue value={284} />);
    expect(screen.getByText('284')).toBeInTheDocument();
  });

  it('renders a string value verbatim', () => {
    render(<MetricValue value="--" unit="W" />);
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('renders the unit in a trailing span', () => {
    render(<MetricValue value={156} unit="bpm" />);
    expect(screen.getByText('bpm')).toBeInTheDocument();
  });

  it('omits the unit span when no unit', () => {
    const { container } = render(<MetricValue value={5} />);
    expect(container.querySelectorAll('span > span')).toHaveLength(1);
  });

  it('is always tabular-nums', () => {
    const { container } = render(<MetricValue value={1} />);
    expect(container.firstChild).toHaveClass('tabular-nums');
  });

  it('uses mono by default and ui when mono=false', () => {
    const { container, rerender } = render(<MetricValue value={1} />);
    expect(container.firstChild).toHaveClass('font-mono');
    rerender(<MetricValue value={1} mono={false} />);
    expect(container.firstChild).toHaveClass('font-ui');
  });

  it('maps size to the fontSize token class', () => {
    const { container, rerender } = render(<MetricValue value={1} size="sm" />);
    expect(container.firstChild).toHaveClass('text-sm');
    rerender(<MetricValue value={1} size="3xl" />);
    expect(container.firstChild).toHaveClass('text-3xl');
  });

  it('makes 2xl and 3xl bold', () => {
    const { container, rerender } = render(
      <MetricValue value={1} size="2xl" />,
    );
    expect(container.firstChild).toHaveClass('font-bold');
    rerender(<MetricValue value={1} size="xl" />);
    expect(container.firstChild).not.toHaveClass('font-bold');
  });

  it('applies custom color inline to the number only', () => {
    render(<MetricValue value={88} unit="%" color="#22c55e" />);
    const num = screen.getByText('88');
    expect(num).toHaveStyle({ color: '#22c55e' });
    expect(screen.getByText('%')).not.toHaveStyle({ color: '#22c55e' });
  });

  it('forwards className', () => {
    const { container } = render(<MetricValue value={1} className="mt-4" />);
    expect(container.firstChild).toHaveClass('mt-4');
  });

  it('shows the final value immediately when animated=false', () => {
    render(<MetricValue value={312} animated={false} />);
    expect(screen.getByText('312')).toBeInTheDocument();
  });

  it('shows the final value for a string even when animated', () => {
    render(<MetricValue value="N/A" animated />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<MetricValue value={284} unit="W" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
