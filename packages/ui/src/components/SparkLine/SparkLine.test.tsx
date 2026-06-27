import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SparkLine } from './SparkLine';

expect.extend(toHaveNoViolations);

const data = [1, 4, 2, 8, 5];

function svg(container: HTMLElement) {
  return container.querySelector('svg')!;
}

describe('SparkLine', () => {
  it('renders an svg at the requested dimensions', () => {
    const { container } = render(
      <SparkLine data={data} width={100} height={40} />,
    );
    const el = svg(container);
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('width', '100');
    expect(el).toHaveAttribute('height', '40');
  });

  it('is decorative (aria-hidden)', () => {
    const { container } = render(<SparkLine data={data} />);
    expect(svg(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws a single stroke path with round caps by default', () => {
    const { container } = render(<SparkLine data={data} />);
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(1);
    expect(paths[0]).toHaveAttribute('stroke-linecap', 'round');
    expect(paths[0]).toHaveAttribute('stroke-width', '1.5');
    expect(paths[0]).toHaveAttribute('fill', 'none');
  });

  it('uses the default accent color when none is given', () => {
    const { container } = render(<SparkLine data={data} />);
    expect(container.querySelector('path')).toHaveAttribute(
      'stroke',
      '#8b5cf6',
    );
  });

  it('applies a custom color', () => {
    const { container } = render(<SparkLine data={data} color="#22c55e" />);
    expect(container.querySelector('path')).toHaveAttribute(
      'stroke',
      '#22c55e',
    );
  });

  it('renders an empty svg with no paths for empty data', () => {
    const { container } = render(<SparkLine data={[]} width={64} height={24} />);
    const el = svg(container);
    expect(el).toHaveAttribute('width', '64');
    expect(el.querySelectorAll('path')).toHaveLength(0);
  });

  it('renders a flat line for a single point', () => {
    const { container } = render(
      <SparkLine data={[5]} width={64} height={24} />,
    );
    const d = container.querySelector('path')!.getAttribute('d')!;
    // Two coords spanning the full width at one y; both y values equal.
    const ys = [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => m[2]);
    expect(ys).toHaveLength(2);
    expect(ys[0]).toBe(ys[1]);
    expect(d).toContain('M0');
    expect(d).toContain('L64');
  });

  it('renders an area fill with a gradient when showArea', () => {
    const { container } = render(<SparkLine data={data} showArea />);
    expect(container.querySelector('linearGradient')).toBeInTheDocument();
    // line path + area path
    expect(container.querySelectorAll('path')).toHaveLength(2);
  });

  it('gives each instance a unique gradient id', () => {
    const { container } = render(
      <>
        <SparkLine data={data} showArea />
        <SparkLine data={data} showArea />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map((g) =>
      g.getAttribute('id'),
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('draws a dashed reference line at the given value', () => {
    const { container } = render(
      <SparkLine data={data} referenceValue={4} />,
    );
    const line = container.querySelector('line');
    expect(line).toBeInTheDocument();
    expect(line).toHaveAttribute('stroke-dasharray', '2 2');
  });

  it('adds the draw animation only when animated', () => {
    const { container, rerender } = render(<SparkLine data={data} />);
    expect(container.querySelector('path')!.style.animation).toBe('');
    rerender(<SparkLine data={data} animated />);
    expect(container.querySelector('path')!.style.animation).toContain(
      'aura-sparkline-draw',
    );
  });

  it('forwards className to the svg', () => {
    const { container } = render(<SparkLine data={data} className="mt-2" />);
    expect(svg(container)).toHaveClass('mt-2');
  });

  it('has no axe violations', async () => {
    const { container } = render(<SparkLine data={data} showArea />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
