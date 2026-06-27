import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { MoodPicker } from './MoodPicker';

const meta: Meta<typeof MoodPicker> = {
  title: 'Inputs/MoodPicker',
  component: MoodPicker,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof MoodPicker>;

function Controlled({ initial }: { initial: string | null }) {
  const [v, setV] = useState<string | null>(initial);
  return <MoodPicker value={v} onChange={setV} />;
}

export const Empty: Story = { render: () => <Controlled initial={null} /> };
export const Selected: Story = { render: () => <Controlled initial="energized" /> };
