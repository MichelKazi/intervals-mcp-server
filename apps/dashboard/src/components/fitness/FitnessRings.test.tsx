import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FitnessRings, { tsbBand } from './FitnessRings';

describe('FitnessRings', () => {
  it('renders three labeled metrics', () => {
    render(<FitnessRings fitness={50} fatigue={48} form={2} />);
    expect(screen.getByText('Fitness')).toBeInTheDocument();
    expect(screen.getByText('Fatigue')).toBeInTheDocument();
    expect(screen.getByText('Form')).toBeInTheDocument();
  });

  it('shows rounded numeric values', () => {
    render(<FitnessRings fitness={50.5} fatigue={48.2} form={2.3} />);
    // fitness = 51, fatigue = 48, form = +2
    expect(screen.getByText('51')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('form=-20 shows optimal/training band label', () => {
    render(<FitnessRings fitness={60} fatigue={80} form={-20} />);
    expect(screen.getByText('Optimal training')).toBeInTheDocument();
  });

  it('form=+30 shows transition or fresh band label', () => {
    render(<FitnessRings fitness={80} fatigue={50} form={30} />);
    // form=30 > 25 → Transition
    expect(screen.getByText('Transition')).toBeInTheDocument();
  });

  it('form=+10 shows fresh band label', () => {
    render(<FitnessRings fitness={60} fatigue={50} form={10} />);
    expect(screen.getByText('Fresh')).toBeInTheDocument();
  });

  it('form=0 shows neutral band label', () => {
    render(<FitnessRings fitness={50} fatigue={50} form={0} />);
    expect(screen.getByText('Neutral')).toBeInTheDocument();
  });

  it('form=-35 shows high risk band label', () => {
    render(<FitnessRings fitness={40} fatigue={75} form={-35} />);
    expect(screen.getByText('High risk')).toBeInTheDocument();
  });

  it('renders without crashing when form is negative', () => {
    const { container } = render(<FitnessRings fitness={50} fatigue={70} form={-20} />);
    expect(container).toBeTruthy();
  });

  it('shows − sign for negative form, + sign for positive form', () => {
    const { rerender } = render(<FitnessRings fitness={40} fatigue={60} form={-20} />);
    expect(screen.getByText('-20')).toBeInTheDocument();

    rerender(<FitnessRings fitness={60} fatigue={40} form={20} />);
    expect(screen.getByText('+20')).toBeInTheDocument();
  });
});

describe('tsbBand', () => {
  it('> 25 → Transition', () => expect(tsbBand(26).label).toBe('Transition'));
  it('5..25 → Fresh', () => expect(tsbBand(15).label).toBe('Fresh'));
  it('-10..5 → Neutral', () => expect(tsbBand(-5).label).toBe('Neutral'));
  it('exactly 0 → Neutral', () => expect(tsbBand(0).label).toBe('Neutral'));
  it('-30..-10 → Optimal training', () => expect(tsbBand(-20).label).toBe('Optimal training'));
  it('< -30 → High risk', () => expect(tsbBand(-35).label).toBe('High risk'));
});
