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
    // Wait for day cells to render (skeleton clears)
    await page.waitForSelector('button[data-date]', { timeout: 10000 });
  });

  test('week view renders with day number cells (default)', async ({ page }) => {
    // Week view is the default: should have many day cells (17 weeks × 7 = 119)
    const dayCells = page.locator('button[data-date]');
    const count = await dayCells.count();

    // At minimum one week of 7 cells
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test('current month/year label is shown in the header', async ({ page }) => {
    const today = new Date();
    const expectedMonth = MONTH_NAMES[today.getMonth()];
    const expectedYear = today.getFullYear();

    // Header shows month + year label (both week and month view show this)
    const header = page.locator(`text=${expectedMonth} ${expectedYear}`);
    await expect(header).toBeVisible({ timeout: 5000 });
  });

  test('days with events show a sport glyph indicator', async ({ page }) => {
    // At least one day cell has a sport glyph indicator
    const glyphs = page.locator('[data-testid="sport-glyph-indicator"]');
    const count = await glyphs.count();

    // Events exist in the current period — assert at least 1 is present
    expect(count).toBeGreaterThan(0);
  });

  test('today is marked distinctly in the grid', async ({ page }) => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const todayIso = `${yyyy}-${mm}-${dd}`;

    // Today cell should have aria-label containing "(today)"
    const todayCell = page.locator(`button[data-date="${todayIso}"]`);
    await expect(todayCell).toBeVisible({ timeout: 5000 });
    const label = await todayCell.getAttribute('aria-label');
    expect(label).toContain('today');
  });

  test('tapping a day with events opens the day-detail sheet', async ({ page }) => {
    // Find a day cell that has a sport glyph indicator
    const glyphContainer = page.locator('[data-testid="sport-glyph-indicator"]').first();
    await expect(glyphContainer).toBeVisible({ timeout: 5000 });

    // Find the parent day cell button
    const dayCell = glyphContainer.locator('xpath=ancestor::button[@data-date]').first();
    const date = await dayCell.getAttribute('data-date');
    expect(date).toBeTruthy();

    // Tap the day cell to open the sheet
    await dayCell.tap();

    // Sheet should open — check for agenda-event-row inside the sheet
    await page.waitForTimeout(400); // animation settle
    const agendaItems = page.locator('[data-testid="agenda-event-row"]');
    const agendaCount = await agendaItems.count();
    expect(agendaCount).toBeGreaterThan(0);

    // No error state visible
    await expect(page.locator('text=Could not load')).not.toBeVisible();
  });

  test('month view toggle shows month grid with 28-42 day cells', async ({ page }) => {
    // Click the Month tab to switch to month view
    const monthTab = page.locator('[role="tab"]', { hasText: 'Month' });
    await expect(monthTab).toBeVisible({ timeout: 5000 });
    await monthTab.tap();

    // Month grid should render with prev/next month buttons
    await expect(page.locator('button[aria-label="Previous month"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button[aria-label="Next month"]')).toBeVisible({ timeout: 5000 });

    // Month grid day cells: 28–42
    const dayCells = page.locator('button[data-date]');
    await page.waitForTimeout(300);
    const count = await dayCells.count();
    expect(count).toBeGreaterThanOrEqual(28);
    expect(count).toBeLessThanOrEqual(42);
  });

  test('prev/next month nav in month view changes month label', async ({ page }) => {
    // Switch to month view first
    const monthTab = page.locator('[role="tab"]', { hasText: 'Month' });
    await monthTab.tap();
    await page.locator('button[aria-label="Previous month"]').waitFor({ timeout: 5000 });

    const today = new Date();
    const prevMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
    const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();

    await page.locator('button[aria-label="Previous month"]').tap();

    const expectedLabel = `${MONTH_NAMES[prevMonth]} ${prevYear}`;
    await expect(page.locator(`text=${expectedLabel}`)).toBeVisible({ timeout: 5000 });
  });

  test('next month nav in month view changes month label forward', async ({ page }) => {
    const monthTab = page.locator('[role="tab"]', { hasText: 'Month' });
    await monthTab.tap();
    await page.locator('button[aria-label="Next month"]').waitFor({ timeout: 5000 });

    const today = new Date();
    const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
    const nextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();

    await page.locator('button[aria-label="Next month"]').tap();

    const expectedLabel = `${MONTH_NAMES[nextMonth]} ${nextYear}`;
    await expect(page.locator(`text=${expectedLabel}`)).toBeVisible({ timeout: 5000 });
  });

  test('long-press drag: day cells present and drag does not crash', async ({ page }) => {
    const glyphs = page.locator('[data-testid="sport-glyph-indicator"]');
    await expect(glyphs.first()).toBeVisible({ timeout: 5000 });

    const glyph = glyphs.first();
    const box = await glyph.boundingBox();
    expect(box).not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Dispatch raw pointer events for drag attempt
    await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return;
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true }));
    }, { x: cx, y: cy });

    // Hold for 700ms — enough for the long-press threshold (500ms)
    await page.waitForTimeout(750);

    await page.evaluate(({ x, y }) => {
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 60, clientY: y, pointerId: 1, isPrimary: true }));
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x + 60, clientY: y, pointerId: 1, isPrimary: true }));
    }, { x: cx, y: cy });

    await page.waitForTimeout(300);

    // If drag caused navigation, go back
    if (!page.url().includes('/calendar')) {
      await page.goBack();
      await page.waitForSelector('button[data-date]', { timeout: 5000 });
    }

    // Day cells still present — page did not crash
    expect(await page.locator('button[data-date]').count()).toBeGreaterThanOrEqual(7);
  });
});
