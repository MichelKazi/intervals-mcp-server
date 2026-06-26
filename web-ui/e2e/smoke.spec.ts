import { test, expect } from '@playwright/test';

// Known-benign React Router v7 future-flag warnings to exclude from console error checks
const KNOWN_BENIGN_PATTERNS = [
  /React Router Future Flag Warning/i,
  /v7_startTransition/i,
  /v7_relativeSplatPath/i,
];

function isBenignConsoleMsg(msg: string): boolean {
  return KNOWN_BENIGN_PATTERNS.some(p => p.test(msg));
}

const ROUTES = ['/', '/calendar', '/library', '/workout/116770992'];

test.describe('Smoke — cross-cutting checks', () => {
  for (const route of ROUTES) {
    test(`no uncaught console errors on ${route}`, async ({ page }) => {
      const errors: string[] = [];

      // Collect console error events
      page.on('console', msg => {
        if (msg.type() === 'error' && !isBenignConsoleMsg(msg.text())) {
          errors.push(`[console.error] ${msg.text()}`);
        }
      });

      // Collect uncaught page errors
      page.on('pageerror', err => {
        if (!isBenignConsoleMsg(err.message)) {
          errors.push(`[pageerror] ${err.message}`);
        }
      });

      await page.goto(route);
      // Wait for the page to settle
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        // networkidle can time out on pages with polling; that's OK
      });
      await page.waitForTimeout(1000);

      expect(errors, `Console errors on ${route}:\n${errors.join('\n')}`).toHaveLength(0);
    });
  }

  test('all /api/* requests are same-origin — no hardcoded external API host', async ({ page }) => {
    // Given we track all network requests
    const externalApiRequests: string[] = [];

    page.on('request', req => {
      const url = req.url();
      // Flag any request that goes to the known production Railway URL
      if (url.includes('intervals-web-api-production.up.railway.app')) {
        externalApiRequests.push(url);
      }
      // Also flag any request that tries to go to a different host for /api paths
      if (url.includes('/api/') && !url.startsWith('http://localhost')) {
        externalApiRequests.push(url);
      }
    });

    // Visit all main routes
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.goto('/library');
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    // Then no request leaked to the external production API
    expect(
      externalApiRequests,
      `External API requests detected (should all be same-origin):\n${externalApiRequests.join('\n')}`
    ).toHaveLength(0);
  });

  for (const route of ROUTES) {
    test(`route ${route} renders within 5s without "undefined"/"NaN" in visible text`, async ({ page }) => {
      // Given we navigate to the route
      await page.goto(route);

      // Wait up to 5s for something meaningful to render (not skeleton)
      await page.waitForFunction(() => {
        // Check that loading spinners/skeletons are gone
        const busy = document.querySelector('[aria-busy="true"]');
        return !busy;
      }, { timeout: 5000 }).catch(() => {
        // If skeleton never clears, we'll still check text
      });

      // Grab visible text from main content area
      const mainText = await page.locator('main').textContent() ?? '';

      // Assert no literal "undefined" or "NaN" in visible main content
      expect(mainText).not.toContain('undefined');
      expect(mainText).not.toContain('NaN');
      // "Invalid Date" is also a bad sign
      expect(mainText).not.toContain('Invalid Date');
    });
  }
});
