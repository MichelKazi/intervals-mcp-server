import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MoreGridTemplate } from './MoreGridTemplate';

expect.extend(toHaveNoViolations);

const groups = [
  { title: 'Training', tools: <div data-testid="training-tools" /> },
  { title: 'Analysis', tools: <div data-testid="analysis-tools" /> },
];

describe('MoreGridTemplate', () => {
  it('renders the pmcPreview slot', () => {
    render(<MoreGridTemplate pmcPreview={<div data-testid="pmc" />} />);
    expect(screen.getByTestId('pmc')).toBeInTheDocument();
  });

  it('renders each group title and tools', () => {
    render(<MoreGridTemplate groups={groups} />);
    expect(screen.getByText('Training')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByTestId('training-tools')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-tools')).toBeInTheDocument();
  });

  it('wraps tools in a 2-col grid', () => {
    const { container } = render(<MoreGridTemplate groups={groups} />);
    expect(container.querySelectorAll('.grid.grid-cols-2')).toHaveLength(2);
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <MoreGridTemplate pmcPreview={<div data-testid="pmc" />} groups={groups} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
