import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ZoneBadge } from './ZoneBadge';
import { ZONE_COLORS, ZONE_LABELS } from '../../lib/zones';
import tokens from '../../tokens/generated/tokens';

expect.extend(toHaveNoViolations);

describe('ZoneBadge', () => {
  it('renders zone label by default', () => {
    const { getByText } = render(<ZoneBadge zone={3} />);
    expect(getByText(ZONE_LABELS[3])).toBeInTheDocument();
  });

  it('label prop overrides zone name', () => {
    const { getByText, queryByText } = render(<ZoneBadge zone={1} label="Recovery" />);
    expect(getByText('Recovery')).toBeInTheDocument();
    expect(queryByText(ZONE_LABELS[1])).toBeNull();
  });

  it('subtle variant uses 15% tint, 35% border, text color', () => {
    // zone4 #ef4444 → jsdom serializes hex+alpha to rgba()
    const { getByText } = render(<ZoneBadge zone={4} />);
    const el = getByText(ZONE_LABELS[4]);
    expect(el).toHaveStyle({ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: ZONE_COLORS[4] });
    expect(el.style.border).toBe('1px solid rgba(239, 68, 68, 0.35)');
  });

  it('outline variant is transparent with colored text', () => {
    const { getByText } = render(<ZoneBadge zone={2} variant="outline" />);
    const el = getByText(ZONE_LABELS[2]);
    expect(el.style.backgroundColor).toBe('transparent');
    expect(el).toHaveStyle({ color: ZONE_COLORS[2] });
  });

  it('solid variant fills with color and dark text', () => {
    const { getByText } = render(<ZoneBadge zone={5} variant="solid" />);
    const el = getByText(ZONE_LABELS[5]);
    expect(el).toHaveStyle({ backgroundColor: ZONE_COLORS[5], color: '#07080f' });
  });

  it('color prop maps status and accent keys', () => {
    const { getByText: good } = render(<ZoneBadge color="good" label="G" />);
    expect(good('G')).toHaveStyle({ color: tokens.color.status.good });
    const { getByText: accent } = render(<ZoneBadge color="accent" label="A" />);
    expect(accent('A')).toHaveStyle({ color: tokens.color.accent.primary });
  });

  it('color prop takes precedence over zone', () => {
    const { getByText } = render(<ZoneBadge zone={1} color="danger" label="X" />);
    expect(getByText('X')).toHaveStyle({ color: tokens.color.status.danger });
  });

  it('falls back to accent when neither zone nor color given', () => {
    const { getByText } = render(<ZoneBadge label="Solo" />);
    expect(getByText('Solo')).toHaveStyle({ color: tokens.color.accent.primary });
  });

  it('is always pill shaped, bold, uppercase, xs', () => {
    const { getByText } = render(<ZoneBadge zone={3} />);
    const cls = getByText(ZONE_LABELS[3]).className;
    expect(cls).toContain('rounded-full');
    expect(cls).toContain('font-bold');
    expect(cls).toContain('uppercase');
    expect(cls).toContain('text-xs');
  });

  it.each([
    ['sm', 'px-2'],
    ['md', 'px-3'],
  ] as const)('size %s padding', (size, pad) => {
    const { getByText } = render(<ZoneBadge zone={1} size={size} />);
    expect(getByText(ZONE_LABELS[1]).className).toContain(pad);
  });

  it('merges className', () => {
    const { getByText } = render(<ZoneBadge zone={1} className="extra" />);
    expect(getByText(ZONE_LABELS[1]).className).toContain('extra');
  });

  it('has no a11y violations', async () => {
    const { container } = render(<ZoneBadge zone={3} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
