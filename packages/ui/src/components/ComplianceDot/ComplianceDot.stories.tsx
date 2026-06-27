import type { Meta, StoryObj } from '@storybook/react';
import { ComplianceDot } from './ComplianceDot';

const meta: Meta<typeof ComplianceDot> = {
  title: 'Molecules/ComplianceDot',
  component: ComplianceDot,
  tags: ['autodocs'],
  args: {
    planned: 100,
    actual: 100,
  },
};
export default meta;

type Story = StoryObj<typeof ComplianceDot>;

export const OnTarget: Story = { args: { planned: 100, actual: 95 } };
export const SlightlyUnder: Story = { args: { planned: 100, actual: 80 } };
export const WellUnder: Story = { args: { planned: 100, actual: 50 } };
export const RestDay: Story = { args: { planned: 0, actual: 0 } };

export const WithLabel: Story = {
  args: { planned: 100, actual: 80, showLabel: true },
};

export const Medium: Story = {
  args: { planned: 100, actual: 95, size: 'md' },
};

export const Row: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <ComplianceDot planned={100} actual={95} />
      <ComplianceDot planned={100} actual={80} />
      <ComplianceDot planned={100} actual={40} />
      <ComplianceDot planned={0} actual={0} />
      <ComplianceDot planned={100} actual={92} />
    </div>
  ),
};
