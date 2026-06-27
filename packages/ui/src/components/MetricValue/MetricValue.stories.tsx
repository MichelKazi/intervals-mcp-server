import type { Meta, StoryObj } from '@storybook/react';
import { MetricValue } from './MetricValue';

const meta: Meta<typeof MetricValue> = {
  title: 'Atoms/MetricValue',
  component: MetricValue,
  tags: ['autodocs'],
  args: {
    value: 284,
    unit: 'W',
  },
};
export default meta;

type Story = StoryObj<typeof MetricValue>;

export const Default: Story = {};

export const Large: Story = {
  args: { size: '3xl', value: 72, unit: 'TSS' },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {(['sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const).map((s) => (
        <MetricValue key={s} {...args} size={s} />
      ))}
    </div>
  ),
  args: { value: 156, unit: 'bpm' },
};

export const Colored: Story = {
  args: { size: '2xl', value: 88, unit: '%', color: '#22c55e' },
};

export const SansSerif: Story = {
  args: { mono: false, size: 'xl', value: 4.2, unit: 'h' },
};

export const StringValue: Story = {
  args: { value: '--', unit: 'W' },
};

export const Animated: Story = {
  args: { animated: true, size: '3xl', value: 312, unit: 'W' },
};
