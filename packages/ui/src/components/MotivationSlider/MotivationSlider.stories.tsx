import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { MotivationSlider } from './MotivationSlider';

const meta: Meta<typeof MotivationSlider> = {
  title: 'Inputs/MotivationSlider',
  component: MotivationSlider,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof MotivationSlider>;

function Controlled({ initial }: { initial: number }) {
  const [v, setV] = useState(initial);
  return (
    <div style={{ width: 320 }}>
      <MotivationSlider value={v} onChange={setV} />
    </div>
  );
}

export const Default: Story = { render: () => <Controlled initial={5} /> };
export const Min: Story = { render: () => <Controlled initial={1} /> };
export const Max: Story = { render: () => <Controlled initial={10} /> };
export const Mid: Story = { render: () => <Controlled initial={7} /> };
