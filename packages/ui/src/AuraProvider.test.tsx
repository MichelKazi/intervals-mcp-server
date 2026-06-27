import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AuraProvider } from './AuraProvider';

describe('AuraProvider', () => {
  it('renders children', () => {
    const { getByText } = render(
      <AuraProvider>
        <span>hi</span>
      </AuraProvider>,
    );
    expect(getByText('hi')).toBeInTheDocument();
  });

  it('injects accent override as a CSS variable', () => {
    const { container } = render(
      <AuraProvider theme={{ colors: { accent: { primary: '#06b6d4' } } }}>
        <span>x</span>
      </AuraProvider>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.getPropertyValue('--aura-color-accent-primary')).toBe('#06b6d4');
  });

  it('clamps sharp radius to 0', () => {
    const { container } = render(
      <AuraProvider theme={{ radius: 'sharp' }}>
        <span>x</span>
      </AuraProvider>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.getPropertyValue('--aura-radius-xl')).toBe('0px');
  });

  it('adds 4px for round radius', () => {
    const { container } = render(
      <AuraProvider theme={{ radius: 'round' }}>
        <span>x</span>
      </AuraProvider>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.style.getPropertyValue('--aura-radius-xl')).toBe('24px');
  });

  it('sets motion data attribute', () => {
    const { container } = render(
      <AuraProvider theme={{ motion: 'reduced' }}>
        <span>x</span>
      </AuraProvider>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-aura-motion')).toBe('reduced');
  });
});
