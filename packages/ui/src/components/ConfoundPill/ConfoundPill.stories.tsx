import type { Meta, StoryObj } from '@storybook/react';
import { ConfoundPill } from './ConfoundPill';

const meta: Meta<typeof ConfoundPill> = {
  title: 'Atoms/ConfoundPill',
  component: ConfoundPill,
  tags: ['autodocs'],
  args: {
    type: 'dose',
  },
};
export default meta;

type Story = StoryObj<typeof ConfoundPill>;

export const Default: Story = {};

export const Dose: Story = { args: { type: 'dose' } };
export const PoorSleep: Story = { args: { type: 'poor-sleep' } };
export const HighLoad: Story = { args: { type: 'high-load' } };
export const Travel: Story = { args: { type: 'travel' } };

export const Custom: Story = {
  args: { type: 'custom', label: '🤒 Illness' },
};

export const Overridden: Story = {
  args: { type: 'dose', label: '💊 Medication' },
};
