import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CalendarTemplate } from './CalendarTemplate';
import type { CalendarView } from './CalendarTemplate.types';

const meta: Meta<typeof CalendarTemplate> = {
  title: 'Templates/CalendarTemplate',
  component: CalendarTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof CalendarTemplate>;

export const Default: Story = {
  render: () => {
    const [view, setView] = useState<CalendarView>('week');
    return (
      <CalendarTemplate
        view={view}
        onViewChange={setView}
        weekStrip={<div className="rounded-xl p-4 aura-glass text-text-secondary">Week strip</div>}
        dayList={<div className="rounded-xl p-4 aura-glass text-text-secondary">Day list</div>}
      />
    );
  },
};

export const WithDrawer: Story = {
  args: {
    weekStrip: <div className="rounded-xl p-4 aura-glass text-text-secondary">Week strip</div>,
    drawer: <div className="text-text-primary">Workout details</div>,
  },
};
