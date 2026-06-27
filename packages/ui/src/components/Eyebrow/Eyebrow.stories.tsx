import type { Meta, StoryObj } from '@storybook/react';
import { Eyebrow } from './Eyebrow';

const meta: Meta<typeof Eyebrow> = {
  title: 'Atoms/Eyebrow',
  component: Eyebrow,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Eyebrow>;

export const Default: Story = { args: { children: 'This Week' } };

export const Colors: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow color="accent">Accent</Eyebrow>
      <Eyebrow color="muted">Muted</Eyebrow>
      <Eyebrow color="ghost">Ghost</Eyebrow>
    </div>
  ),
};
