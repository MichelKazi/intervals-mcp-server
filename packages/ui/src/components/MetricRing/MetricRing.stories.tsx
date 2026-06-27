import type { Meta, StoryObj } from '@storybook/react';
import { MetricRing } from './MetricRing';
import tokens from '../../tokens/generated/tokens';
import type { ContributorRowProps } from '../ContributorRow';

const meta: Meta<typeof MetricRing> = {
  title: 'Molecules/MetricRing',
  component: MetricRing,
  tags: ['autodocs'],
  args: {
    value: 78,
    status: 'good',
    statusWord: 'READY',
    meaning: 'Recovery and load are aligned. Go hard today.',
    label: 'READINESS',
  },
};
export default meta;

type Story = StoryObj<typeof MetricRing>;

const contributors: ContributorRowProps[] = [
  { label: 'Sleep', value: 82, displayValue: '7.1h', trend: 'up', color: tokens.color.status.good },
  { label: 'HRV', value: 64, displayValue: '57ms', trend: 'flat', color: tokens.color.accent.primary },
  { label: 'RHR', value: 48, displayValue: '52bpm', trend: 'down', color: tokens.color.status.caution },
];

export const Ready: Story = {};

export const Caution: Story = {
  args: {
    value: 54,
    status: 'caution',
    statusWord: 'EASY',
    meaning: 'HRV is suppressed. Keep it in Zone 2.',
  },
};

export const Danger: Story = {
  args: {
    value: 28,
    status: 'danger',
    statusWord: 'REST',
    meaning: 'Acute fatigue is high. Take a recovery day.',
  },
};

export const Neutral: Story = {
  args: { value: 60, status: 'neutral', statusWord: 'NEUTRAL', meaning: 'Not enough data for a confident verdict.' },
};

export const WithConfound: Story = {
  args: { confound: '💉 Dose day' },
};

export const WithContributors: Story = {
  args: { contributors },
};

export const Expandable: Story = {
  args: { contributors, expandable: true },
};

export const Clamped: Story = {
  args: { value: 150, meaning: 'Value above max clamps to the ceiling.' },
};

export const Small: Story = { args: { size: 'sm' } };
export const Medium: Story = { args: { size: 'md' } };
