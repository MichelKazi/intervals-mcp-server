import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { HomeTemplate } from './HomeTemplate';

expect.extend(toHaveNoViolations);

describe('HomeTemplate', () => {
  it('renders greeting and subtitle', () => {
    render(<HomeTemplate greeting="Good morning" subtitle="Saturday · Week 2" />);
    expect(screen.getByText('Good morning')).toBeInTheDocument();
    expect(screen.getByText('Saturday · Week 2')).toBeInTheDocument();
  });

  it('renders provided slots', () => {
    render(
      <HomeTemplate
        readiness={<div data-testid="readiness" />}
        contextStrip={<div data-testid="context" />}
        workout={<div data-testid="workout" />}
        activities={<div data-testid="activities" />}
      />,
    );
    expect(screen.getByTestId('readiness')).toBeInTheDocument();
    expect(screen.getByTestId('context')).toBeInTheDocument();
    expect(screen.getByTestId('workout')).toBeInTheDocument();
    expect(screen.getByTestId('activities')).toBeInTheDocument();
  });

  it('omits absent slots', () => {
    const { container } = render(<HomeTemplate greeting="Hi" />);
    expect(container.querySelector('section')).toBeNull();
    expect(screen.queryByTestId('workout')).toBeNull();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <HomeTemplate
        greeting="Good morning"
        subtitle="Saturday"
        activities={<div data-testid="activities" />}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
