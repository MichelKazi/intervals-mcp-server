import type { Meta, StoryObj } from '@storybook/react';
import { MoreGridTemplate } from './MoreGridTemplate';

const ToolCard = ({ label }: { label: string }) => (
  <div className="rounded-xl p-4 aura-glass text-text-primary">{label}</div>
);

const meta: Meta<typeof MoreGridTemplate> = {
  title: 'Templates/MoreGridTemplate',
  component: MoreGridTemplate,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    pmcPreview: <div className="rounded-xl p-4 aura-glass text-text-secondary">PMC chart</div>,
    groups: [
      {
        title: 'Training',
        tools: (
          <>
            <ToolCard label="Build block" />
            <ToolCard label="Alternatives" />
          </>
        ),
      },
      {
        title: 'Analysis',
        tools: (
          <>
            <ToolCard label="Ride review" />
            <ToolCard label="Patterns" />
          </>
        ),
      },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof MoreGridTemplate>;

export const Default: Story = {};
