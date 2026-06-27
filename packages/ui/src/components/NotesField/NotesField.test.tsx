import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NotesField } from './NotesField';

expect.extend(toHaveNoViolations);

describe('NotesField', () => {
  it('shows the counter against the default 500 cap', () => {
    const { getByText } = render(<NotesField value="hello" onChange={() => {}} />);
    expect(getByText('5/500')).toBeInTheDocument();
  });

  it('respects a custom maxLength', () => {
    const { getByLabelText, getByText } = render(
      <NotesField value="hi" onChange={() => {}} maxLength={100} />,
    );
    expect(getByLabelText('Notes')).toHaveAttribute('maxLength', '100');
    expect(getByText('2/100')).toBeInTheDocument();
  });

  it('fires onChange with typed text', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<NotesField value="" onChange={onChange} />);
    fireEvent.change(getByLabelText('Notes'), { target: { value: 'note' } });
    expect(onChange).toHaveBeenCalledWith('note');
  });

  it('caps the value passed to onChange at maxLength', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(<NotesField value="" onChange={onChange} maxLength={3} />);
    fireEvent.change(getByLabelText('Notes'), { target: { value: 'abcdef' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('shows the privacy helper text', () => {
    const { getByText } = render(<NotesField value="" onChange={() => {}} />);
    expect(getByText(/only sees that context was provided/i)).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<NotesField value="hi" onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
