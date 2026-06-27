import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FreeTimeGrid } from './FreeTimeGrid';

expect.extend(toHaveNoViolations);

describe('FreeTimeGrid', () => {
  it('renders a radiogroup per weekday', () => {
    const { getAllByRole } = render(<FreeTimeGrid value={null} onChange={() => {}} />);
    expect(getAllByRole('radiogroup')).toHaveLength(7);
  });

  it('marks the matching option for a day as checked', () => {
    const { getByLabelText } = render(
      <FreeTimeGrid value={{ mon: 1.5 }} onChange={() => {}} />,
    );
    expect(getByLabelText('Mon 1½')).toHaveAttribute('aria-checked', 'true');
    expect(getByLabelText('Mon 0')).toHaveAttribute('aria-checked', 'false');
  });

  it('defaults missing days to 0', () => {
    const { getByLabelText } = render(<FreeTimeGrid value={{ mon: 2 }} onChange={() => {}} />);
    expect(getByLabelText('Tue 0')).toHaveAttribute('aria-checked', 'true');
  });

  it('onChange returns the full 7-day map with the updated day', () => {
    const onChange = vi.fn();
    render(<FreeTimeGrid value={{ mon: 1 }} onChange={onChange} />).getByLabelText('Wed 2').click();
    expect(onChange).toHaveBeenCalledWith({
      mon: 1,
      tue: 0,
      wed: 2,
      thu: 0,
      fri: 0,
      sat: 0,
      sun: 0,
    });
  });

  it('3+ stores as 3', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<FreeTimeGrid value={null} onChange={onChange} />);
    fireEvent.click(getByLabelText('Fri 3+'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ fri: 3 }));
  });

  it('has no a11y violations', async () => {
    const { container } = render(<FreeTimeGrid value={{ mon: 1 }} onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
