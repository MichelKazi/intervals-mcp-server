import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Eyebrow } from './Eyebrow';
import tokens from '../../tokens/generated/tokens';

expect.extend(toHaveNoViolations);

describe('Eyebrow', () => {
  it('renders children in a span', () => {
    const { getByText } = render(<Eyebrow>Label</Eyebrow>);
    expect(getByText('Label').tagName).toBe('SPAN');
  });

  it('applies typographic spec classes', () => {
    const { getByText } = render(<Eyebrow>X</Eyebrow>);
    const cls = getByText('X').className;
    expect(cls).toContain('uppercase');
    expect(cls).toContain('font-bold');
    expect(cls).toContain('text-xs');
    expect(cls).toContain('tracking-[0.15em]');
    expect(cls).toContain('font-ui');
  });

  it('defaults to muted color class', () => {
    const { getByText } = render(<Eyebrow>X</Eyebrow>);
    expect(getByText('X').className).toContain('text-text-muted');
  });

  it('ghost uses ghost color class', () => {
    const { getByText } = render(<Eyebrow color="ghost">X</Eyebrow>);
    expect(getByText('X').className).toContain('text-text-ghost');
  });

  it('accent uses inline accent color', () => {
    const { getByText } = render(<Eyebrow color="accent">X</Eyebrow>);
    expect(getByText('X')).toHaveStyle({ color: tokens.color.accent.primary });
  });

  it('merges className', () => {
    const { getByText } = render(<Eyebrow className="extra">X</Eyebrow>);
    expect(getByText('X').className).toContain('extra');
  });

  it('has no a11y violations', async () => {
    const { container } = render(<Eyebrow>Section</Eyebrow>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
