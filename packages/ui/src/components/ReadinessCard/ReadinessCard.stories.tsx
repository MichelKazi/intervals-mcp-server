import type { Meta, StoryObj } from '@storybook/react';
import { ReadinessCard } from './ReadinessCard';
import { ZONE_COLORS } from '../../lib/zones';

const contributors = [
  { label: 'HRV', value: 82, displayValue: '68ms', trend: 'up' as const, color: ZONE_COLORS[1] },
  { label: 'Sleep', value: 71, displayValue: '6.4h', trend: 'down' as const, color: ZONE_COLORS[2] },
  { label: 'RHR', value: 88, displayValue: '52bpm', trend: 'flat' as const, color: ZONE_COLORS[3] },
  { label: 'Form', value: 64, displayValue: '-8', trend: 'flat' as const, color: ZONE_COLORS[4] },
];

const meta: Meta<typeof ReadinessCard> = {
  title: 'Organisms/ReadinessCard',
  component: ReadinessCard,
  tags: ['autodocs'],
  args: {
    value: 84,
    status: 'caution',
    statusWord: 'Moderate',
    meaning: 'Solid base today. Hold intensity steady and watch how you feel.',
    contributors,
  },
};
export default meta;

type Story = StoryObj<typeof ReadinessCard>;

export const Default: Story = {};

export const WithConfound: Story = {
  args: { confound: 'Dose day' },
};

export const Ready: Story = {
  args: {
    value: 92,
    status: 'good',
    statusWord: 'Ready',
    meaning: 'Strong signals across the board. Good day to push.',
  },
};
