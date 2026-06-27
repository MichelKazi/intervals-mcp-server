import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { StatusPill } from './StatusPill';
import tokens from '../../tokens/generated/tokens';

expect.extend(toHaveNoViolations);

describe('StatusPill', () => {
  it('renders the label', () => {
    render(<StatusPill status="good" label="Ready" />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it.each(['good', 'caution', 'danger'] as const)(
    'colors %s from status tokens',
    (s) => {
      render(<StatusPill status={s} label="X" />);
      const color = tokens.color.status[s];
      expect(screen.getByText('X')).toHaveStyle({
        color,
        backgroundColor: `${color}1f`,
        borderColor: `${color}40`,
      });
    },
  );

  it('neutral uses surface tokens, not inline status color', () => {
    render(<StatusPill status="neutral" label="Unknown" />);
    const pill = screen.getByText('Unknown');
    expect(pill).toHaveClass('bg-bg-raised', 'border-border-default', 'text-text-secondary');
    expect(pill).not.toHaveStyle({ color: tokens.color.status.good });
  });

  it('renders an icon when provided', () => {
    render(<StatusPill status="good" label="Ready" icon={<span>icon</span>} />);
    expect(screen.getByText('icon')).toBeInTheDocument();
  });

  it('defaults to sm padding, applies md when requested', () => {
    const { rerender } = render(<StatusPill status="good" label="X" />);
    expect(screen.getByText('X')).toHaveClass('px-2', 'py-0.5');
    rerender(<StatusPill status="good" label="X" size="md" />);
    expect(screen.getByText('X')).toHaveClass('px-3', 'py-1');
  });

  it('forwards className', () => {
    render(<StatusPill status="neutral" label="X" className="custom-x" />);
    expect(screen.getByText('X')).toHaveClass('custom-x');
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <StatusPill status="caution" label="Watch" icon="⚠️" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
