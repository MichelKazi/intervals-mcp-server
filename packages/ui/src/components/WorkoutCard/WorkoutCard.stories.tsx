import type { Meta, StoryObj } from '@storybook/react';
import { WorkoutCard } from './WorkoutCard';
import type { PowerInterval } from '../PowerChart/PowerChart.types';

const intervals: PowerInterval[] = [
  { durationSecs: 600, powerPct: 0.55, zone: 1, isWarmup: true },
  { durationSecs: 300, powerPct: 1.05, zone: 4 },
  { durationSecs: 180, powerPct: 0.5, zone: 1, isRecovery: true },
  { durationSecs: 300, powerPct: 1.05, zone: 4 },
  { durationSecs: 600, powerPct: 0.5, zone: 1, isCooldown: true },
];

const meta: Meta<typeof WorkoutCard> = {
  title: 'Molecules/WorkoutCard',
  component: WorkoutCard,
  tags: ['autodocs'],
  args: {
    name: 'Sweet Spot Base 2x20',
    date: 'Tue, Jun 30',
    type: 'Ride',
    durationSecs: 5880,
    tss: 78,
  },
};
export default meta;

type Story = StoryObj<typeof WorkoutCard>;

export const Planned: Story = { args: { status: 'planned' } };
export const Completed: Story = { args: { status: 'completed' } };
export const Unlogged: Story = { args: { status: 'unlogged' } };

export const WithBadge: Story = { args: { intensityFactor: 0.88 } };

export const WithChart: Story = {
  args: {
    intensityFactor: 0.94,
    intervals,
    summary: '2 x 5min at threshold with easy spinning between. Hard but doable.',
  },
};

export const Clickable: Story = {
  args: { intensityFactor: 0.88, onClick: () => alert('opened') },
};
