import type { Meta, StoryObj } from '@storybook/react';
import { ActivityRow } from './ActivityRow';

const meta: Meta<typeof ActivityRow> = {
  title: 'Molecules/ActivityRow',
  component: ActivityRow,
  tags: ['autodocs'],
  args: {
    name: 'Threshold 3x12',
    date: 'Mon, Jun 23',
    durationSecs: 7080,
    tss: 92,
    zone: 3,
  },
};
export default meta;

type Story = StoryObj<typeof ActivityRow>;

export const Default: Story = {};

export const WithDistance: Story = {
  args: { name: 'Long endurance ride', date: 'Sun, Jun 22', durationSecs: 12600, tss: 140, zone: 1, distanceM: 92500 },
};

export const Race: Story = {
  args: { name: 'Crit race', date: 'Sat, Jun 21', durationSecs: 3300, tss: 110, zone: 5, isRace: true, distanceM: 40000 },
};

export const Interval: Story = {
  args: { name: 'VO2max 5x4', date: 'Fri, Jun 20', durationSecs: 3600, tss: 78, zone: 4, isInterval: true },
};

export const Clickable: Story = {
  args: { onClick: () => alert('opened activity') },
};

export const Stacked: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-3">
      <ActivityRow name="Threshold 3x12" date="Mon, Jun 23" durationSecs={7080} tss={92} zone={3} />
      <ActivityRow name="Crit race" date="Sat, Jun 21" durationSecs={3300} tss={110} zone={5} isRace distanceM={40000} />
      <ActivityRow name="Recovery spin" date="Fri, Jun 20" durationSecs={2700} tss={28} zone={1} />
    </div>
  ),
};
