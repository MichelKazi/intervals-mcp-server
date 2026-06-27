import type { Meta, StoryObj } from '@storybook/react';
import { HomeTemplate } from './HomeTemplate';
import { ReadinessCard } from '../ReadinessCard';
import { WorkoutCard } from '../WorkoutCard';

const meta: Meta<typeof HomeTemplate> = {
  title: 'Templates/HomeTemplate',
  component: HomeTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    greeting: 'Good morning',
    subtitle: 'Saturday · Week 2 of base block',
  },
};
export default meta;

type Story = StoryObj<typeof HomeTemplate>;

export const Default: Story = {
  args: {
    readiness: (
      <ReadinessCard value={84} status="caution" statusWord="Moderate" meaning="Hold steady." />
    ),
    workout: (
      <WorkoutCard
        name="Sweet Spot Base"
        date="Saturday"
        type="Ride"
        durationSecs={4500}
        tss={68}
      />
    ),
  },
};

export const HeaderOnly: Story = {};
