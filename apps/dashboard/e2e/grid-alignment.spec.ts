import { test, expect } from '@playwright/test';

/**
 * Grid contract: every content card on a screen snaps to the 16px page gutter.
 * Cards inside a .stat-grid / .grid are intentionally fractional columns and
 * are exempt. Runs at iPhone 17 Pro Max width — the widest target — so a card
 * that drifts off the gutter on any device fails here.
 */
test.use({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

const GUTTER = 16;
const ROUTES = [
  '/', '/more', '/more/ftp-goal', '/more/field-test', '/more/settings',
  '/more/polarization', '/more/planned-vs-actual', '/more/dose-log', '/more/fitness',
];

for (const path of ROUTES) {
  test(`cards align to the 16px grid on ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1200);
    const offenders = await page.evaluate((g) => {
      const vw = document.documentElement.clientWidth;
      const bad: string[] = [];
      document.querySelectorAll('main .card, main .card-glass, main .card-pad-sm').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 100 || el.closest('.stat-grid, .grid')) return;
        const okL = Math.abs(r.left - g) <= 1.5;
        const okR = Math.abs(vw - r.right - g) <= 1.5;
        if (!(okL && okR)) bad.push(`${(el.className || '').toString().slice(0, 30)} L=${Math.round(r.left)} R=${Math.round(vw - r.right)}`);
      });
      return bad;
    }, GUTTER);
    expect(offenders, `off-grid cards on ${path}`).toEqual([]);
  });
}
