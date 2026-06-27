import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ConfoundPill } from './ConfoundPill';
import tokens from '../../tokens/generated/tokens';

expect.extend(toHaveNoViolations);

const amber = tokens.color.status.caution;

describe('ConfoundPill', () => {
  it.each([
    ['dose', '💉 Dose day'],
    ['poor-sleep', '😴 Poor sleep'],
    ['high-load', '📈 High load'],
    ['travel', '✈️ Travel'],
  ] as const)('type %s renders default label', (type, label) => {
    render(<ConfoundPill type={type} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders custom label for type custom', () => {
    render(<ConfoundPill type="custom" label="🤒 Illness" />);
    expect(screen.getByText('🤒 Illness')).toBeInTheDocument();
  });

  it('explicit label overrides the default', () => {
    render(<ConfoundPill type="dose" label="💊 Medication" />);
    expect(screen.getByText('💊 Medication')).toBeInTheDocument();
    expect(screen.queryByText('💉 Dose day')).not.toBeInTheDocument();
  });

  it('is always amber regardless of type', () => {
    render(<ConfoundPill type="travel" />);
    expect(screen.getByText('✈️ Travel')).toHaveStyle({
      color: amber,
      backgroundColor: `${amber}26`,
      borderColor: `${amber}59`,
    });
  });

  it('forwards className', () => {
    render(<ConfoundPill type="dose" className="custom-x" />);
    expect(screen.getByText('💉 Dose day')).toHaveClass('custom-x');
  });

  it('label word, not just emoji, conveys meaning', () => {
    render(<ConfoundPill type="poor-sleep" />);
    expect(screen.getByText(/Poor sleep/)).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<ConfoundPill type="high-load" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
