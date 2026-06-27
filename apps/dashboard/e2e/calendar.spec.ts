import { test, expect } from '@playwright/test';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    // Clear stored view preference so week is the default
    await page.addInitScript(() => {
      localStorage.removeItem('cal_view');
    });
    await page.goto('/calendar');
    await page.waitForSelector('button[data-date]', { timeout: 10000 });
  });

  test('week strip renders with day columns and compliance dots', async ({ page }) => {
    // Week strip is the default view
    await expect(page.locator('[data-testid="week-strip"]').first()).toBeVisible({ timeout: 5000 });

    const dayCells = page.locator('button[data-date]');
    expect(await dayCells.count()).toBeGreaterThanOrEqual(7);

    // Each visible week column carries a compliance dot (role=img with a verdict label)
    const complianceDots = page.getByRole('img', { name: /completed|planned|skipped|no planned/i });
    expect(await complianceDots.count()).toBeGreaterThanOrEqual(7);
  });

  test('current month/year label is shown in the header', async ({ page }) => {
    const today = new Date();
    const header = page.locator(`text=${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`);
    await expect(header.first()).toBeVisible({ timeout: 5000 });
  });

  test('day list defaults to today and rows carry a zone dot + sport icon', async ({ page }) => {
    const list = page.locator('[data-testid="day-list"]');
    await expect(list).toBeVisible({ timeout: 5000 });

    // At least one item row with a zone dot and sport svg, OR an empty-day message
    const rows = page.locator('[data-testid="agenda-event-row"]');
    const rowCount = await rows.count();
    if (rowCount > 0) {
      const firstRow = rows.first();
      await expect(firstRow.getByRole('img', { name: /Zone/ })).toBeVisible();
      expect(await firstRow.locator('svg[data-sport]').count()).toBeGreaterThan(0);
    } else {
      await expect(list).toContainText(/nothing scheduled/i);
    }
  });

  test('today is marked distinctly in the week strip', async ({ page }) => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const todayIso = `${today.getFullYear()}-${mm}-${dd}`;

    const todayCell = page.locator(`button[data-date="${todayIso}"]`);
    await expect(todayCell.first()).toBeVisible({ timeout: 5000 });
    const label = await todayCell.first().getAttribute('aria-label');
    expect(label).toContain('today');
  });

  test('tapping a day filters the day list to that day', async ({ page }) => {
    const cells = page.locator('button[data-date]');
    const count = await cells.count();
    expect(count).toBe(7); // single visible week

    // Tap the first column of the week and confirm the list header reflects that date.
    const target = cells.first();
    const date = await target.getAttribute('data-date');
    expect(date).toBeTruthy();
    await target.tap();
    await page.waitForTimeout(200);

    const expectedWeekday = new Date(date! + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const list = page.locator('[data-testid="day-list"]');
    await expect(list).toContainText(expectedWeekday);
    await expect(page.locator('text=Could not load')).not.toBeVisible();
  });

  test('week nav buttons change the visible week', async ({ page }) => {
    const firstCellDate = await page.locator('button[data-date]').first().getAttribute('data-date');
    await page.locator('button[aria-label="Next week"]').tap();
    await page.waitForTimeout(200);
    const afterNextDate = await page.locator('button[data-date]').first().getAttribute('data-date');
    expect(afterNextDate).not.toBe(firstCellDate);
  });

  test('tapping a list row opens the activity detail drawer', async ({ page }) => {
    const rows = page.locator('[data-testid="agenda-event-row"]');

    // Find a day with items: scan the strip and tap until the list has rows.
    if ((await rows.count()) === 0) {
      const cells = page.locator('button[data-date]');
      const total = await cells.count();
      for (let i = 0; i < total; i++) {
        await cells.nth(i).tap();
        await page.waitForTimeout(120);
        if ((await rows.count()) > 0) break;
      }
    }

    await expect(rows.first()).toBeVisible({ timeout: 5000 });
    await rows.first().locator('button').first().tap();

    // Drawer: an "Open full detail" action appears
    await expect(page.getByRole('button', { name: /open full detail/i })).toBeVisible({ timeout: 5000 });
    // Drawer is not cut off — its title is visible
    await expect(page.locator('[role="dialog"]').first()).toBeVisible();
  });

  test('month view toggle shows month grid with 28-42 day cells', async ({ page }) => {
    const monthTab = page.locator('[role="tab"]', { hasText: 'Month' });
    await expect(monthTab).toBeVisible({ timeout: 5000 });
    await monthTab.tap();

    await expect(page.locator('button[aria-label="Previous month"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button[aria-label="Next month"]')).toBeVisible({ timeout: 5000 });

    const dayCells = page.locator('button[data-date]');
    await page.waitForTimeout(300);
    const count = await dayCells.count();
    expect(count).toBeGreaterThanOrEqual(28);
    expect(count).toBeLessThanOrEqual(42);
  });

  test('prev/next month nav in month view changes month label', async ({ page }) => {
    const monthTab = page.locator('[role="tab"]', { hasText: 'Month' });
    await monthTab.tap();
    await page.locator('button[aria-label="Previous month"]').waitFor({ timeout: 5000 });

    const today = new Date();
    const prevMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
    const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();

    await page.locator('button[aria-label="Previous month"]').tap();
    await expect(page.locator(`text=${MONTH_NAMES[prevMonth]} ${prevYear}`)).toBeVisible({ timeout: 5000 });
  });

  test('long-press drag in month view: day cells present and drag does not crash', async ({ page }) => {
    // Drag rescheduling lives on month-grid zone-dot glyphs.
    const monthTab = page.locator('[role="tab"]', { hasText: 'Month' });
    await monthTab.tap();
    await page.locator('button[aria-label="Previous month"]').waitFor({ timeout: 5000 });
    // Month query may reload — wait for the grid to repopulate its day cells.
    await expect.poll(() => page.locator('button[data-date]').count(), { timeout: 8000 })
      .toBeGreaterThanOrEqual(28);

    const glyphs = page.locator('[data-testid="sport-glyph-indicator"]');
    if ((await glyphs.count()) === 0) {
      // No events this month — nothing to drag, just confirm grid is intact.
      expect(await page.locator('button[data-date]').count()).toBeGreaterThanOrEqual(28);
      return;
    }

    const glyph = glyphs.first();
    const box = await glyph.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return;
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true }));
    }, { x: cx, y: cy });

    await page.waitForTimeout(750);

    await page.evaluate(({ x, y }) => {
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 60, clientY: y, pointerId: 1, isPrimary: true }));
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x + 60, clientY: y, pointerId: 1, isPrimary: true }));
    }, { x: cx, y: cy });

    await page.waitForTimeout(300);

    if (!page.url().includes('/calendar')) {
      await page.goBack();
      await page.waitForSelector('button[data-date]', { timeout: 5000 });
    }

    expect(await page.locator('button[data-date]').count()).toBeGreaterThanOrEqual(7);
  });
});
