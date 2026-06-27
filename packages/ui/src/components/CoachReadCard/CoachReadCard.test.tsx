import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CoachReadCard } from './CoachReadCard';

expect.extend(toHaveNoViolations);

describe('CoachReadCard', () => {
  it('shows "Not yet generated" when no refresh date', () => {
    const { getByText } = render(<CoachReadCard trainingHistory={null} dropoutRisk={null} />);
    expect(getByText('Not yet generated')).toBeInTheDocument();
  });

  it('shows the formatted updated date', () => {
    const { getByText } = render(
      <CoachReadCard trainingHistory="x" refreshedAt="2026-06-20T09:00:00Z" />,
    );
    expect(getByText(/Updated /)).toBeInTheDocument();
  });

  it('disables the trigger when there is no content', () => {
    const { getByLabelText } = render(<CoachReadCard trainingHistory={null} dropoutRisk={null} />);
    expect(getByLabelText('Coach read')).toBeDisabled();
  });

  it('previews combined history and adherence', () => {
    const { getByText } = render(
      <CoachReadCard trainingHistory="solid base" dropoutRisk="low risk" />,
    );
    expect(getByText(/solid base · low risk/)).toBeInTheDocument();
  });

  it('opens a modal with both labelled sections', () => {
    const { getByLabelText, getByRole, getByText } = render(
      <CoachReadCard trainingHistory="history text" dropoutRisk="pattern text" />,
    );
    fireEvent.click(getByLabelText('Coach read'));
    expect(getByRole('dialog')).toBeInTheDocument();
    expect(getByText('Training history')).toBeInTheDocument();
    expect(getByText('Adherence pattern')).toBeInTheDocument();
    expect(getByText('history text')).toBeInTheDocument();
    expect(getByText('pattern text')).toBeInTheDocument();
  });

  it('renders an em dash for an empty section in the modal', () => {
    const { getByLabelText, getByText } = render(
      <CoachReadCard trainingHistory="only history" dropoutRisk={null} />,
    );
    fireEvent.click(getByLabelText('Coach read'));
    expect(getByText('—')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <CoachReadCard trainingHistory="h" dropoutRisk="d" refreshedAt="2026-06-20T09:00:00Z" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
