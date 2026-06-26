import { test, expect } from '@playwright/test';

test.describe('Library', () => {
  test.beforeEach(async ({ page }) => {
    // Given the library page is loaded
    await page.goto('/library');
    // Wait for the search input to be visible
    await page.waitForSelector('input[aria-label="Search workouts"]', { timeout: 10000 });
  });

  test('search bar and zone filter chips render', async ({ page }) => {
    // When the library loads
    // Then the search input is present
    await expect(page.locator('input[aria-label="Search workouts"]')).toBeVisible();

    // And zone filter chips are shown (e.g. Threshold, VO2max, etc.)
    const chipGroup = page.locator('[aria-label="Filter by zone"]');
    await expect(chipGroup).toBeVisible();
    const chips = chipGroup.locator('button');
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThanOrEqual(4);
  });

  test('typing a zone name in search routes to zone-filtered results', async ({ page }) => {
    // When the user types "threshold" in the search box
    // The backend routes zone keywords (threshold, vo2max, etc.) to zone_focus filters
    // since TR workout names are place names, not zone descriptions.
    const searchInput = page.locator('input[aria-label="Search workouts"]');
    await searchInput.fill('threshold');

    // Wait for debounce (300ms) + network roundtrip
    await page.waitForTimeout(600);

    // Wait for loading skeletons to clear
    await page.waitForFunction(() => {
      const loading = document.querySelectorAll('[aria-label="Loading"]');
      return loading.length === 0;
    }, { timeout: 8000 });

    // After the fix, "threshold" routes to zone_focus=threshold results.
    // Results appear as buttons with TSS or interval count in the result list.
    const resultArea = page.locator('main');
    const resultButtons = resultArea.locator('button[type="button"]').filter({
      hasText: /TSS|intervals/,
    });
    const count = await resultButtons.count();
    expect(count).toBeGreaterThan(0);

    // First result has a non-empty workout name
    const firstText = await resultButtons.first().textContent();
    expect(firstText).toBeTruthy();
    expect(firstText!.trim().length).toBeGreaterThan(0);
    expect(firstText).not.toContain('undefined');

    // Duration is shown (e.g. "1h 30m" or "45m")
    const hasDuration = /\d+\s*(h|m|min)/.test(firstText ?? '');
    expect(hasDuration).toBe(true);
  });

  test('clicking a zone chip shows active state', async ({ page }) => {
    // Given the zone filter group is visible
    const chipGroup = page.locator('[aria-label="Filter by zone"]');
    const thresholdChip = chipGroup.locator('button', { hasText: 'Threshold' });

    // When the user taps the Threshold chip
    await thresholdChip.tap();
    await page.waitForTimeout(200);

    // Then the chip shows an active/selected state
    // FilterChip uses aria-pressed or a background style change
    const pressed = await thresholdChip.getAttribute('aria-pressed');
    const style = await thresholdChip.getAttribute('style');

    // At least one of these indicates active state
    const isActive = pressed === 'true' || (style !== null && style.includes('opacity: 1'));
    expect(isActive).toBe(true);
  });

  test('"More filters" expands additional filter controls', async ({ page }) => {
    // When the user taps "More filters"
    const moreBtn = page.locator('button', { hasText: /More filters/i });
    await expect(moreBtn).toBeVisible();
    await moreBtn.tap();

    // Then additional filters appear (duration, TSS)
    await expect(page.locator('select#duration-max')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Max TSS')).toBeVisible();
  });

  test('tapping a result opens a preview sheet with workout details', async ({ page }) => {
    // Given there are results loaded
    await page.waitForFunction(() => {
      const loading = document.querySelectorAll('[aria-label="Loading"]');
      return loading.length === 0;
    }, { timeout: 8000 });

    // Wait for at least one result button with TSS/intervals to appear
    const resultButtons = page.locator('main button[type="button"]').filter({
      hasText: /TSS|intervals/,
    });
    await expect(resultButtons.first()).toBeVisible({ timeout: 5000 });

    // When the user taps a result
    await resultButtons.first().tap();

    // Then a preview sheet/panel appears (role="dialog")
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });

    // And it shows "Add to calendar" and "Schedule date" label
    await expect(page.locator('text=Add to calendar')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#schedule-date')).toBeVisible();
  });

  test('nonsense search shows empty state, not an error', async ({ page }) => {
    // When the user searches for a string that matches nothing
    const searchInput = page.locator('input[aria-label="Search workouts"]');
    await searchInput.fill('zzzzqqqq');

    // Wait for debounce (300ms) + network
    await page.waitForTimeout(600);
    await page.waitForFunction(() => {
      const loading = document.querySelectorAll('[aria-label="Loading"]');
      return loading.length === 0;
    }, { timeout: 8000 });

    // The ResultList empty state text: "No workouts match — adjust filters."
    await expect(page.locator('text=No workouts match')).toBeVisible({ timeout: 5000 });

    // And it's NOT an error state (no alert role)
    await expect(page.locator('[role="alert"]')).not.toBeVisible();
  });
});
