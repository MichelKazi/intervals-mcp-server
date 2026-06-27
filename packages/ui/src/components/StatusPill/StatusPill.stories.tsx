import type { Meta, StoryObj } from '@storybook/react';
import { StatusPill } from './StatusPill';

const meta: Meta<typeof StatusPill> = {
  title: 'Atoms/StatusPill',
  component: StatusPill,
  tags: ['autodocs'],
  args: {
    status: 'good',
    label: 'Ready',
  },
};
export default meta;

type Story = StoryObj<typeof StatusPill>;

export const Default: Story = {};

export const Good: Story = { args: { status: 'good', label: 'Ready' } };
export const Caution: Story = { args: { status: 'caution', label: 'Watch' } };
export const Danger: Story = { args: { status: 'danger', label: 'Rest' } };
export const Neutral: Story = { args: { status: 'neutral', label: 'Unknown' } };

export const WithIcon: Story = {
  args: { status: 'good', label: 'Ready', icon: '✅' },
};

export const Medium: Story = {
  args: { status: 'caution', label: 'Watch', size: 'md', icon: '⚠️' },
};
