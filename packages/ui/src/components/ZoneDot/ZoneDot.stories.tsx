import type { Meta, StoryObj } from '@storybook/react';
import { ZoneDot } from './ZoneDot';

const meta: Meta<typeof ZoneDot> = {
  title: 'Atoms/ZoneDot',
  component: ZoneDot,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ZoneDot>;

export const Default: Story = { args: { zone: 3 } };

export const AllZones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {([1, 2, 3, 4, 5] as const).map((z) => (
        <ZoneDot key={z} zone={z} />
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {(['xs', 'sm', 'md', 'lg'] as const).map((s) => (
        <ZoneDot key={s} zone={4} size={s} />
      ))}
    </div>
  ),
};

export const Pulse: Story = { args: { zone: 5, size: 'lg', pulse: true } };
