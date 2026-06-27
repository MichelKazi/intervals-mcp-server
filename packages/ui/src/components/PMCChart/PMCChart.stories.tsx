import type { Meta, StoryObj } from '@storybook/react';
import { PMCChart } from './PMCChart';
import type { PMCDataPoint } from './PMCChart.types';

function buildData(days: number): PMCDataPoint[] {
  const out: PMCDataPoint[] = [];
  const start = new Date('2026-01-01');
  let ctl = 40;
  let atl = 38;
  for (let i = 0; i < days; i++) {
    const load = 30 + 25 * Math.sin(i / 6) + (i % 7 === 0 ? -20 : 0);
    ctl += (load - ctl) / 42;
    atl += (load - atl) / 7;
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    out.push({
      date: d.toISOString().slice(0, 10),
      ctl: Math.round(ctl),
      atl: Math.round(atl),
      tsb: Math.round(ctl - atl),
    });
  }
  return out;
}

const data = buildData(112);

const meta: Meta<typeof PMCChart> = {
  title: 'Molecules/PMCChart',
  component: PMCChart,
  tags: ['autodocs'],
  decorators: [(Story) => <div className="w-[600px]"><Story /></div>],
  args: { data },
};
export default meta;

type Story = StoryObj<typeof PMCChart>;

export const Default: Story = {};

export const Interactive: Story = {
  args: { interactive: true, period: '8w' },
};

export const Last4Weeks: Story = {
  args: { period: '4w' },
};

export const Empty: Story = {
  args: { data: [] },
};
