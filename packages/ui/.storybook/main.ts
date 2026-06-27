import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)', '../src/**/*.mdx'],
  addons: [
    '@storybook/addon-essentials', // docs, controls, viewport, measure, backgrounds
    '@storybook/addon-a11y', // contrast + ARIA checks
    '@storybook/addon-interactions', // play() function testing
  ],
  framework: { name: '@storybook/react-vite', options: {} },
  docs: { autodocs: 'tag' },
};
export default config;
