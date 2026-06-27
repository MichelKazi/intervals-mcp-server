import type { Meta, StoryObj } from '@storybook/react';
import { CalendarWeekStrip } from './CalendarWeekStrip';
import type { CalendarDay } from './CalendarWeekStrip.types';

const week: CalendarDay[] = [
  { date: new Date(2026, 5, 22), plannedTSS: 60, actualTSS: 58, zone: 2 },
  { date: new Date(2026, 5, 23), plannedTSS: 95, actualTSS: 92, zone: 4, isHardDay: true },
  { date: new Date(2026, 5, 24), plannedTSS: 0, actualTSS: 0 },
  { date: new Date(2026, 5, 25), plannedTSS: 78, actualTSS: 50, zone: 3, isHardDay: true },
  { date: new Date(2026, 5, 26), plannedTSS: 45, actualTSS: 0, zone: 1, isToday: true },
  { date: new Date(2026, 5, 27), plannedTSS: 120, actualTSS: 0, zone: 5, isRace: true },
  { date: new Date(2026, 5, 28), plannedTSS: 140, actualTSS: 0, zone: 5, isArace: true },
];

const meta: Meta<typeof CalendarWeekStrip> = {
  title: 'Organisms/CalendarWeekStrip',
  component: CalendarWeekStrip,
  tags: ['autodocs'],
  args: { days: week },
};
export default meta;

type Story = StoryObj<typeof CalendarWeekStrip>;

export const Default: Story = {};

export const Selectable: Story = {
  args: { selectedDate: new Date(2026, 5, 25), onSelectDate: (d) => alert(d.toDateString()) },
};
