import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { NotesField } from './NotesField';

const meta: Meta<typeof NotesField> = {
  title: 'Inputs/NotesField',
  component: NotesField,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof NotesField>;

function Controlled({ initial }: { initial: string }) {
  const [v, setV] = useState(initial);
  return (
    <div style={{ width: 358 }}>
      <NotesField value={v} onChange={setV} placeholder="Anything the coach should know" />
    </div>
  );
}

export const Empty: Story = { render: () => <Controlled initial="" /> };
export const WithText: Story = {
  render: () => <Controlled initial="Travelling Mon-Wed, only trainer access." />,
};
export const NearCap: Story = { render: () => <Controlled initial={'x'.repeat(495)} /> };
