import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MotivationSlider } from './MotivationSlider';

expect.extend(toHaveNoViolations);

describe('MotivationSlider', () => {
  it('renders a slider with the current value', () => {
    const { getByRole, getByText } = render(<MotivationSlider value={7} onChange={() => {}} />);
    const slider = getByRole('slider') as HTMLInputElement;
    expect(slider.value).toBe('7');
    expect(getByText('7')).toBeInTheDocument();
  });

  it('exposes min 1 and max 10', () => {
    const { getByRole } = render(<MotivationSlider value={5} onChange={() => {}} />);
    const slider = getByRole('slider');
    expect(slider).toHaveAttribute('min', '1');
    expect(slider).toHaveAttribute('max', '10');
  });

  it('calls onChange with the numeric value', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<MotivationSlider value={5} onChange={onChange} />);
    fireEvent.change(getByRole('slider'), { target: { value: '8' } });
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('clamps an out-of-range value into 1-10', () => {
    const { getByRole, rerender } = render(<MotivationSlider value={0} onChange={() => {}} />);
    expect((getByRole('slider') as HTMLInputElement).value).toBe('1');
    rerender(<MotivationSlider value={42} onChange={() => {}} />);
    expect((getByRole('slider') as HTMLInputElement).value).toBe('10');
  });

  it('uses the provided label', () => {
    const { getByLabelText } = render(
      <MotivationSlider value={5} onChange={() => {}} label="How motivated?" />,
    );
    expect(getByLabelText('How motivated?')).toBeInTheDocument();
  });

  it('paints a red→green gradient track', () => {
    const { getByRole } = render(<MotivationSlider value={5} onChange={() => {}} />);
    const bg = (getByRole('slider') as HTMLInputElement).style.background;
    expect(bg).toContain('linear-gradient');
    expect(bg).toContain('#ef4444'); // danger red
    expect(bg).toContain('#22c55e'); // good green
  });

  it('has no a11y violations', async () => {
    const { container } = render(<MotivationSlider value={5} onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
