import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MoodPicker } from './MoodPicker';

expect.extend(toHaveNoViolations);

describe('MoodPicker', () => {
  it('shows a placeholder when no value', () => {
    const { getByLabelText } = render(<MoodPicker value={null} onChange={() => {}} />);
    expect(getByLabelText('Mood')).toHaveTextContent('Select mood');
  });

  it('shows the current mood label when set', () => {
    const { getByLabelText } = render(<MoodPicker value="energized" onChange={() => {}} />);
    expect(getByLabelText('Mood')).toHaveTextContent('Energized');
  });

  it('opens a modal dialog on click', () => {
    const { getByLabelText, getByRole } = render(<MoodPicker value={null} onChange={() => {}} />);
    fireEvent.click(getByLabelText('Mood'));
    expect(getByRole('dialog')).toBeInTheDocument();
  });

  it('filters options by the fuzzy text input', () => {
    const { getByLabelText, queryByText, getByText } = render(
      <MoodPicker value={null} onChange={() => {}} />,
    );
    fireEvent.click(getByLabelText('Mood'));
    fireEvent.change(getByLabelText('Filter moods'), { target: { value: 'ener' } });
    expect(getByText('Energized')).toBeInTheDocument();
    expect(queryByText('Tired')).toBeNull();
  });

  it('selecting an option fires onChange with the key and closes', () => {
    const onChange = vi.fn();
    const { getByLabelText, getByText, queryByRole } = render(
      <MoodPicker value={null} onChange={onChange} />,
    );
    fireEvent.click(getByLabelText('Mood'));
    fireEvent.click(getByText('Drained'));
    expect(onChange).toHaveBeenCalledWith('drained');
    expect(queryByRole('dialog')).toBeNull();
  });

  it('marks the current option as pressed', () => {
    const { getByLabelText, getByRole } = render(
      <MoodPicker value="steady" onChange={() => {}} />,
    );
    fireEvent.click(getByLabelText('Mood'));
    // The trigger also renders "Steady"; scope to the pressed chip in the dialog.
    expect(getByRole('button', { name: 'Steady', pressed: true })).toBeInTheDocument();
  });

  it('has no a11y violations when open', async () => {
    const { getByLabelText, container } = render(<MoodPicker value="fresh" onChange={() => {}} />);
    fireEvent.click(getByLabelText('Mood'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
