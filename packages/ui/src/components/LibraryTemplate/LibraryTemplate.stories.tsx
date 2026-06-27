import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { LibraryTemplate } from './LibraryTemplate';
import type { Zone } from '../../lib/zones';

const meta: Meta<typeof LibraryTemplate> = {
  title: 'Templates/LibraryTemplate',
  component: LibraryTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof LibraryTemplate>;

export const Default: Story = {
  render: () => {
    const [active, setActive] = useState<Zone[]>([3]);
    const toggle = (z: Zone) =>
      setActive((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
    return (
      <LibraryTemplate
        search={
          <input
            className="w-full rounded-xl bg-bg-surface px-4 py-2 text-text-primary"
            placeholder="Search workouts"
          />
        }
        activeZones={active}
        onToggleZone={toggle}
        items={<div className="rounded-xl p-4 aura-glass text-text-secondary">Workout list</div>}
      />
    );
  },
};
