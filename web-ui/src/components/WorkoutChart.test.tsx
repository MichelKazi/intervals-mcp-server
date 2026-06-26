import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkoutChart from './WorkoutChart';
import type { WorkoutStep } from '../lib/types';

const steps: WorkoutStep[] = [
  { duration: 600, power: { units: 'percent', value: 50 } },
  {
    reps: 3,
    steps: [
      { duration: 300, power: { units: 'percent', value: 110 } },
      { duration: 120, power: { units: 'percent', value: 55 } },
    ],
  },
  { duration: 300, power: { units: 'percent', value: 50 } },
];

describe('WorkoutChart', () => {
  it('renders 8 bars for 1 warmup + 3×2 intervals + 1 cooldown', () => {
    render(<WorkoutChart steps={steps} />);
    const bars = screen.getAllByTestId('workout-bar');
    expect(bars).toHaveLength(8);
  });

  it('clicking first bar shows recovery zone in readout', () => {
    render(<WorkoutChart steps={steps} />);
    const bars = screen.getAllByTestId('workout-bar');
    fireEvent.click(bars[0]);
    const readout = screen.getByTestId('workout-readout');
    expect(readout.textContent).toMatch(/recovery|50%/i);
  });

  it('clicking second bar (first vo2max interval) shows vo2max in readout', () => {
    render(<WorkoutChart steps={steps} />);
    const bars = screen.getAllByTestId('workout-bar');
    fireEvent.click(bars[1]);
    const readout = screen.getByTestId('workout-readout');
    expect(readout.textContent).toMatch(/vo2max|110%/i);
  });
});
