import type { Meta, StoryObj } from '@storybook/react';
import { ContributorRow } from './ContributorRow';
import tokens from '../../tokens/generated/tokens';

const meta: Meta<typeof ContributorRow> = {
  title: 'Molecules/ContributorRow',
  component: ContributorRow,
  tags: ['autodocs'],
  args: {
    label: 'Sleep',
    value: 78,
    color: tokens.color.accent.primary,
  },
};
export default meta;

type Story = StoryObj<typeof ContributorRow>;

export const Default: Story = {};

export const WithDisplayValue: Story = {
  args: { label: 'Sleep', value: 78, displayValue: '6.4h' },
};

export const TrendUp: Story = {
  args: { label: 'HRV', value: 64, displayValue: '57ms', trend: 'up' },
};

export const TrendDown: Story = {
  args: { label: 'RHR', value: 40, displayValue: '57bpm', trend: 'down' },
};

export const TrendFlat: Story = {
  args: { label: 'Load', value: 55, trend: 'flat' },
};

export const Animated: Story = {
  args: { label: 'Sleep', value: 78, displayValue: '6.4h', animated: true },
};

export const Stacked: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-2">
      <ContributorRow label="Sleep" value={78} displayValue="6.4h" trend="up" color={tokens.color.status.good} />
      <ContributorRow label="HRV" value={64} displayValue="57ms" trend="flat" color={tokens.color.accent.primary} />
      <ContributorRow label="RHR" value={40} displayValue="52bpm" trend="down" color={tokens.color.status.caution} />
    </div>
  ),
};
