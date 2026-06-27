import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ZoneDot } from './ZoneDot';
import { ZONE_COLORS, ZONE_LABELS, type Zone } from '../../lib/zones';

expect.extend(toHaveNoViolations);

const ZONES: Zone[] = [1, 2, 3, 4, 5];

describe('ZoneDot', () => {
  it('renders with role img and zone aria-label', () => {
    const { getByRole } = render(<ZoneDot zone={3} />);
    expect(getByRole('img')).toHaveAttribute('aria-label', `Zone 3: ${ZONE_LABELS[3]}`);
  });

  it('colors each zone from ZONE_COLORS', () => {
    for (const z of ZONES) {
      const { getByRole, unmount } = render(<ZoneDot zone={z} />);
      expect(getByRole('img')).toHaveStyle({ backgroundColor: ZONE_COLORS[z] });
      unmount();
    }
  });

  it('defaults to md (8px)', () => {
    const { getByRole } = render(<ZoneDot zone={1} />);
    expect(getByRole('img')).toHaveStyle({ width: '8px', height: '8px' });
  });

  it.each([
    ['xs', '4px'],
    ['sm', '6px'],
    ['md', '8px'],
    ['lg', '12px'],
  ] as const)('sizes %s to %s', (size, px) => {
    const { getByRole } = render(<ZoneDot zone={2} size={size} />);
    expect(getByRole('img')).toHaveStyle({ width: px, height: px });
  });

  it('adds animate-pulse only when pulse', () => {
    const { getByRole, rerender } = render(<ZoneDot zone={1} />);
    expect(getByRole('img').className).not.toContain('animate-pulse');
    rerender(<ZoneDot zone={1} pulse />);
    expect(getByRole('img').className).toContain('animate-pulse');
  });

  it('merges className', () => {
    const { getByRole } = render(<ZoneDot zone={1} className="extra" />);
    expect(getByRole('img').className).toContain('extra');
  });

  it('has no a11y violations', async () => {
    const { container } = render(<ZoneDot zone={4} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
