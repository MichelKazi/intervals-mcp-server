import type { Meta, StoryObj } from '@storybook/react';
import { AdaptiveBadge } from './AdaptiveBadge';

const meta: Meta<typeof AdaptiveBadge> = {
  title: 'Atoms/AdaptiveBadge',
  component: AdaptiveBadge,
  tags: ['autodocs'],
  args: {
    intensityFactor: 0.88,
  },
};
export default meta;

type Story = StoryObj<typeof AdaptiveBadge>;

export const Default: Story = {};

export const Recovery: Story = { args: { intensityFactor: 0.6 } };
export const Achievable: Story = { args: { intensityFactor: 0.8 } };
export const Productive: Story = { args: { intensityFactor: 0.9 } };
export const Stretch: Story = { args: { intensityFactor: 0.98 } };
export const Breakthrough: Story = { args: { intensityFactor: 1.1 } };

export const Medium: Story = { args: { size: 'md' } };

export const WithTooltip: Story = {
  args: { intensityFactor: 0.98, showTooltip: true },
};
