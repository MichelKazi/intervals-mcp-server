import type { Meta, StoryObj } from '@storybook/react';
import { LibraryItem } from './LibraryItem';

const meta: Meta<typeof LibraryItem> = {
  title: 'Organisms/LibraryItem',
  component: LibraryItem,
  tags: ['autodocs'],
  args: {
    name: 'Spencer +2',
    tss: 98,
    intervalCount: 6,
    durationSecs: 4500,
    primaryZone: 4,
    zones: [4, 5],
    intensityFactor: 1.02,
  },
};
export default meta;

type Story = StoryObj<typeof LibraryItem>;

export const Default: Story = {};

export const SingleZone: Story = {
  args: { name: 'Carter', primaryZone: 2, zones: undefined, intensityFactor: 0.78 },
};

export const Clickable: Story = {
  args: { onClick: () => alert('opened') },
};
