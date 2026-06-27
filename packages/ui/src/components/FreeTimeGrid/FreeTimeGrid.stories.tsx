import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FreeTimeGrid } from './FreeTimeGrid';
import type { FreeTimeMap } from './FreeTimeGrid.types';

const meta: Meta<typeof FreeTimeGrid> = {
  title: 'Inputs/FreeTimeGrid',
  component: FreeTimeGrid,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof FreeTimeGrid>;

function Controlled({ initial }: { initial: Partial<FreeTimeMap> | null }) {
  const [v, setV] = useState<Partial<FreeTimeMap> | null>(initial);
  return (
    <div style={{ width: 358 }}>
      <FreeTimeGrid value={v} onChange={setV} />
    </div>
  );
}

export const Empty: Story = { render: () => <Controlled initial={null} /> };
export const Filled: Story = {
  render: () => (
    <Controlled initial={{ mon: 1, tue: 0.5, wed: 1.5, thu: 0, fri: 2, sat: 3, sun: 3 }} />
  ),
};
