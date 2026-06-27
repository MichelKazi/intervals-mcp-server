import type { Meta, StoryObj } from '@storybook/react';
import { PowerChart } from './PowerChart';
import type { PowerInterval } from './PowerChart.types';

const meta: Meta<typeof PowerChart> = {
  title: 'Molecules/PowerChart',
  component: PowerChart,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof PowerChart>;

const warmup: PowerInterval = { durationSecs: 600, powerPct: 0.5, zone: 1, isWarmup: true, label: 'Warmup' };
const cooldown: PowerInterval = { durationSecs: 300, powerPct: 0.45, zone: 1, isCooldown: true, label: 'Cooldown' };

const threshold: PowerInterval[] = [
  warmup,
  { durationSecs: 480, powerPct: 0.98, zone: 3, label: 'Threshold 1' },
  { durationSecs: 240, powerPct: 0.55, zone: 1, isRecovery: true, label: 'Recovery' },
  { durationSecs: 480, powerPct: 0.99, zone: 3, label: 'Threshold 2' },
  { durationSecs: 240, powerPct: 0.55, zone: 1, isRecovery: true, label: 'Recovery' },
  { durationSecs: 480, powerPct: 1.0, zone: 3, label: 'Threshold 3' },
  cooldown,
];

export const ThresholdSession: Story = {
  args: {
    intervals: threshold,
    summary: '3 × 8 min at threshold with 4 min easy between. Builds sustainable power.',
    showLegend: true,
  },
};

export const Endurance: Story = {
  args: {
    intervals: [
      warmup,
      { durationSecs: 3600, powerPct: 0.65, zone: 1, label: 'Endurance' },
      cooldown,
    ],
  },
};

export const VO2max: Story = {
  args: {
    intervals: [
      warmup,
      ...Array.from({ length: 5 }, (_, i) => [
        { durationSecs: 180, powerPct: 1.2, zone: 4 as const, label: `VO2 ${i + 1}` },
        { durationSecs: 180, powerPct: 0.5, zone: 1 as const, isRecovery: true, label: 'Recovery' },
      ]).flat(),
      cooldown,
    ],
    summary: '5 × 3 min at VO2max with equal recovery. Raises aerobic ceiling.',
    showLegend: true,
    interactive: true,
  },
};

export const FlatBars: Story = {
  args: { intervals: threshold, gradientBars: false, summary: threshold && 'Flat fill variant.' },
};

export const NoFtpLine: Story = {
  args: { intervals: threshold, ftpLine: false, summary: 'No FTP hairline.' },
};

export const Interactive: Story = {
  args: { intervals: threshold, interactive: true, summary: 'Tap or arrow-key a bar.', showLegend: true },
};

export const Empty: Story = { args: { intervals: [] } };
