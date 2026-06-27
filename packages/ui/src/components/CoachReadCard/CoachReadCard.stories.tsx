import type { Meta, StoryObj } from '@storybook/react';
import { CoachReadCard } from './CoachReadCard';

const meta: Meta<typeof CoachReadCard> = {
  title: 'Cards/CoachReadCard',
  component: CoachReadCard,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof CoachReadCard>;

export const NotGenerated: Story = {
  render: () => <CoachReadCard trainingHistory={null} dropoutRisk={null} refreshedAt={null} />,
};

export const Generated: Story = {
  render: () => (
    <CoachReadCard
      trainingHistory="Consistent 6-8h/week for the last 12 weeks, strong threshold base, limited VO2max exposure."
      dropoutRisk="Low. Misses the occasional Friday but never strings two weeks of low volume together."
      refreshedAt="2026-06-20T09:00:00Z"
    />
  ),
};
