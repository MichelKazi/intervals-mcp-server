import React from 'react';
import type { Preview } from '@storybook/react';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'aura-base',
      values: [
        { name: 'aura-base', value: '#07080f' },
        { name: 'aura-surface', value: '#0d0e1a' },
        { name: 'light', value: '#ffffff' }, // contrast testing
      ],
    },
    viewport: {
      viewports: {
        mobile: { name: 'iPhone 15', styles: { width: '390px', height: '844px' } },
        mobileSm: { name: 'iPhone SE', styles: { width: '375px', height: '667px' } },
      },
      defaultViewport: 'mobile',
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'color-contrast-enhanced', enabled: true },
        ],
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="aura-mesh-bg font-ui text-text-primary" style={{ minHeight: '100vh', padding: '24px' }}>
        <Story />
      </div>
    ),
  ],
};
export default preview;
