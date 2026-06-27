import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ComplianceDot } from './ComplianceDot';
import tokens from '../../tokens/generated/tokens';

expect.extend(toHaveNoViolations);

describe('ComplianceDot', () => {
  it('renders a rest-day dash when planned is 0', () => {
    render(<ComplianceDot planned={0} actual={0} />);
    const el = screen.getByRole('img', { name: 'Rest day' });
    expect(el).toHaveTextContent('—');
  });

  it('treats negative planned as a rest day', () => {
    render(<ComplianceDot planned={-1} actual={0} />);
    expect(screen.getByRole('img', { name: 'Rest day' })).toBeInTheDocument();
  });

  it('renders green on target when ratio >= 0.9', () => {
    render(<ComplianceDot planned={100} actual={95} />);
    const el = screen.getByRole('img', { name: 'On target' });
    expect(el).toHaveStyle({ backgroundColor: tokens.color.status.good });
  });

  it('renders amber caution when 0.75 <= ratio < 0.9', () => {
    render(<ComplianceDot planned={100} actual={80} />);
    const el = screen.getByRole('img', { name: 'Slightly under' });
    expect(el).toHaveStyle({ backgroundColor: tokens.color.status.caution });
  });

  it('renders red danger when ratio < 0.75', () => {
    render(<ComplianceDot planned={100} actual={50} />);
    const el = screen.getByRole('img', { name: 'Well under' });
    expect(el).toHaveStyle({ backgroundColor: tokens.color.status.danger });
  });

  it('boundary: ratio exactly 0.9 is on target', () => {
    render(<ComplianceDot planned={100} actual={90} />);
    expect(screen.getByRole('img', { name: 'On target' })).toBeInTheDocument();
  });

  it('boundary: ratio exactly 0.75 is slightly under', () => {
    render(<ComplianceDot planned={100} actual={75} />);
    expect(screen.getByRole('img', { name: 'Slightly under' })).toBeInTheDocument();
  });

  it('boundary: just below 0.75 is well under', () => {
    render(<ComplianceDot planned={100} actual={74} />);
    expect(screen.getByRole('img', { name: 'Well under' })).toBeInTheDocument();
  });

  it('sizes the dot: sm=8px default, md=12px', () => {
    const { rerender } = render(<ComplianceDot planned={100} actual={95} />);
    expect(screen.getByRole('img', { name: 'On target' })).toHaveStyle({
      width: '8px',
      height: '8px',
    });
    rerender(<ComplianceDot planned={100} actual={95} size="md" />);
    expect(screen.getByRole('img', { name: 'On target' })).toHaveStyle({
      width: '12px',
      height: '12px',
    });
  });

  it('hides the label by default, shows it when showLabel', () => {
    const { rerender } = render(<ComplianceDot planned={100} actual={80} />);
    expect(screen.queryByText('Slightly under')).not.toBeInTheDocument();
    rerender(<ComplianceDot planned={100} actual={80} showLabel />);
    expect(screen.getByText('Slightly under')).toBeInTheDocument();
  });

  it('shows the rest-day label text when showLabel', () => {
    render(<ComplianceDot planned={0} actual={0} showLabel />);
    expect(screen.getByText('Rest day')).toBeInTheDocument();
  });

  it('never uses the word "missed"', () => {
    const { container } = render(<ComplianceDot planned={100} actual={10} showLabel />);
    expect(container.innerHTML.toLowerCase()).not.toContain('missed');
  });

  it('forwards className', () => {
    render(<ComplianceDot planned={100} actual={95} className="custom-x" />);
    expect(screen.getByRole('img', { name: 'On target' }).parentElement).toHaveClass('custom-x');
  });

  it('has no a11y violations', async () => {
    const { container } = render(<ComplianceDot planned={100} actual={80} showLabel />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
