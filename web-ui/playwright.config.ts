import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8133',
    // Block the service worker so tests always hit the live server, not a cached response.
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: {
        browserName: 'chromium',
        // iPhone 13 dimensions
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        // Mobile user agent so the app behaves as a mobile PWA
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/112.0.5615.167 Mobile/15E148 Safari/604.1',
        deviceScaleFactor: 3,
      },
    },
  ],
});
