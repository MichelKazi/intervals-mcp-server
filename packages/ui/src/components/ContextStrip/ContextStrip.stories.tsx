import type { Meta, StoryObj } from '@storybook/react';
import { ContextStrip } from './ContextStrip';

const meta: Meta<typeof ContextStrip> = {
  title: 'Organisms/ContextStrip',
  component: ContextStrip,
  tags: ['autodocs'],
  args: {
    plannedTSS: 78,
    form: -5,
    formLabel: 'Neutral',
    timingStatus: 'good',
    timingLabel: 'Good timing',
  },
};
export default meta;

type Story = StoryObj<typeof ContextStrip>;

export const Good: Story = {};

export const Ok: Story = {
  args: { form: 8, formLabel: 'Fresh', timingStatus: 'ok', timingLabel: 'OK timing' },
};

export const Risky: Story = {
  args: { form: -22, formLabel: 'Fatigued', timingStatus: 'risky', timingLabel: 'Risky' },
};
