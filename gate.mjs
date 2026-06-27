import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.env.BASE || 'http://localhost:8134';
const ROUTES = ['/', '/calendar', '/library', '/more'];
const VIEWPORTS = [
  { name: '375', width: 375, height: 667 }, // iPhone SE
  { name: '390', width: 390, height: 844 }, // iPhone 15
  { name: '440', width: 440, height: 956 }, // iPhone 17 Pro Max
];

const browser = await chromium.launch();
let totalViolations = 0;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 3,
    serviceWorkers: 'block',
  });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500); // let queries settle + animations finish
    const name = route === '/' ? 'home' : route.slice(1);
    await page.screenshot({ path: `/tmp/gate-${name}-${vp.name}.png` });

    // a11y scan only once per route (at 390) to keep output focused
    if (vp.name === '390') {
      await page.evaluate(axeSource);
      const results = await page.evaluate(async () => {
        return await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });
      });
      const v = results.violations;
      totalViolations += v.length;
      console.log(`\n=== ${route} (a11y) ===`);
      if (v.length === 0) {
        console.log('  ✓ 0 violations');
      } else {
        for (const item of v) {
          console.log(`  ✗ [${item.impact}] ${item.id}: ${item.help} (${item.nodes.length} nodes)`);
          for (const n of item.nodes.slice(0, 3)) {
            console.log(`      ${n.target.join(' ')} — ${(n.failureSummary || '').replace(/\n/g, ' ')}`);
          }
        }
      }
    }
    await page.close();
  }
  await ctx.close();
}

await browser.close();
console.log(`\nTOTAL VIOLATIONS: ${totalViolations}`);
process.exit(totalViolations > 0 ? 1 : 0);
