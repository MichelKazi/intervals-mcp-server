import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ContextStrip } from './ContextStrip';

expect.extend(toHaveNoViolations);

const base = {
  plannedTSS: 78,
  form: -5,
  formLabel: 'Neutral',
  timingStatus: 'good' as const,
  timingLabel: 'Good timing',
};

describe('ContextStrip', () => {
  it('renders planned TSS, form, and form label', () => {
    const { container } = render(<ContextStrip {...base} />);
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('-5')).toBeInTheDocument();
    expect(container.textContent).toContain('Neutral');
  });

  it('renders the timing StatusPill with its label', () => {
    render(<ContextStrip {...base} />);
    expect(screen.getByText('Good timing')).toBeInTheDocument();
  });

  it.each([
    ['good', 'good'],
    ['ok', 'caution'],
    ['risky', 'danger'],
  ] as const)('maps timingStatus %s to label visibility', (timingStatus, _status) => {
    render(<ContextStrip {...base} timingStatus={timingStatus} timingLabel={`t-${timingStatus}`} />);
    expect(screen.getByText(`t-${timingStatus}`)).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<ContextStrip {...base} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
