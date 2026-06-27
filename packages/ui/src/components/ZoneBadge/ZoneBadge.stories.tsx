import type { Meta, StoryObj } from '@storybook/react';
import { ZoneBadge } from './ZoneBadge';

const meta: Meta<typeof ZoneBadge> = {
  title: 'Atoms/ZoneBadge',
  component: ZoneBadge,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ZoneBadge>;

export const Default: Story = { args: { zone: 3 } };

export const AllZones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {([1, 2, 3, 4, 5] as const).map((z) => (
        <ZoneBadge key={z} zone={z} />
      ))}
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <ZoneBadge zone={4} variant="subtle" />
      <ZoneBadge zone={4} variant="outline" />
      <ZoneBadge zone={4} variant="solid" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <ZoneBadge zone={2} size="sm" />
      <ZoneBadge zone={2} size="md" />
    </div>
  ),
};

export const StatusColors: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <ZoneBadge color="good" label="Ready" />
      <ZoneBadge color="caution" label="Caution" />
      <ZoneBadge color="danger" label="Rest" />
      <ZoneBadge color="accent" label="Accent" />
    </div>
  ),
};

export const CustomLabel: Story = { args: { zone: 1, label: 'Recovery' } };
