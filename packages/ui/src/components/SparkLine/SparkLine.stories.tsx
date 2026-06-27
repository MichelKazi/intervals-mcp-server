import type { Meta, StoryObj } from '@storybook/react';
import { SparkLine } from './SparkLine';

const meta: Meta<typeof SparkLine> = {
  title: 'Atoms/SparkLine',
  component: SparkLine,
  tags: ['autodocs'],
  args: {
    data: [3, 5, 4, 8, 6, 9, 7, 11, 10, 14],
  },
};
export default meta;

type Story = StoryObj<typeof SparkLine>;

export const Default: Story = {};

export const WithArea: Story = {
  args: { showArea: true },
};

export const WithReferenceLine: Story = {
  args: { referenceValue: 7 },
};

export const Animated: Story = {
  args: { animated: true, showArea: true },
};

export const Larger: Story = {
  args: { width: 160, height: 48, showArea: true },
};

export const SinglePoint: Story = {
  args: { data: [5] },
};

export const Empty: Story = {
  args: { data: [] },
};
