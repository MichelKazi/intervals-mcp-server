import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the readiness card to appear (skeleton cleared)
    await page.waitForSelector('[aria-label="Readiness"]', { timeout: 10000 });
  });

  test('readiness card shows a verdict word and reasoning text', async ({ page }) => {
    const readiness = page.locator('[aria-label="Readiness"]');
    await expect(readiness).toBeVisible();

    const text = await readiness.textContent();
    const hasVerdict = ['READY', 'MODERATE', 'REST'].some((v) => text!.includes(v));
    expect(hasVerdict).toBe(true);
    // Reasoning text present (more than just the verdict word)
    expect(text!.trim().length).toBeGreaterThan(6);
  });

  test('tapping readiness card opens the contributor breakdown sheet', async ({ page }) => {
    await page.locator('[aria-label="Readiness"]').tap();
    await expect(page.getByText('Contributors')).toBeVisible({ timeout: 5000 });
  });

  test('load-match strip shows planned TSS', async ({ page }) => {
    await expect(page.getByText(/TSS planned/i)).toBeVisible();
  });

  test('next-workout card shows a real workout name', async ({ page }) => {
    const hero = page.locator('[aria-label*="Next workout"]');
    await expect(hero).toBeVisible();
    const name = await hero.locator('h2').first().textContent();
    expect(name).toBeTruthy();
    expect(name).not.toBe('undefined');
    expect(name!.trim().length).toBeGreaterThan(0);
  });

  test('next-workout metadata is free of "undefined"/"NaN"/"Invalid Date"', async ({ page }) => {
    const hero = page.locator('[aria-label*="Next workout"]');
    const heroText = await hero.textContent();
    expect(heroText).not.toContain('undefined');
    expect(heroText).not.toContain('NaN');
    expect(heroText).not.toContain('Invalid Date');
  });

  test('next-workout renders WorkoutChart bars', async ({ page }) => {
    const bars = page.locator('[data-testid="workout-bar"]');
    expect(await bars.count()).toBeGreaterThan(0);
  });

  test('tapping next-workout navigates to /workout/:id and loads the detail screen', async ({ page }) => {
    const hero = page.locator('[aria-label*="Next workout"]');
    await hero.tap();
    await expect(page).toHaveURL(/\/workout\/\d+/, { timeout: 8000 });
    const h1 = page.locator('header h1');
    await expect(h1).toBeVisible({ timeout: 8000 });
    const title = await h1.textContent();
    expect(title).not.toContain('Could not load workout');
    expect(title).not.toContain('undefined');
  });

  test('recent activities section renders', async ({ page }) => {
    const recent = page.locator('[aria-label="Recent activities"]');
    await expect(recent).toBeVisible();
    // Either rows render or the empty-state message is shown
    const text = await recent.textContent();
    expect(text).toContain('Recent');
  });

  test('bottom nav has 4 tabs each at least 44px tall', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();
    const tabs = nav.locator('a');
    await expect(tabs).toHaveCount(4);

    await expect(page.getByTestId('nav-tab-home')).toBeVisible();
    await expect(page.getByTestId('nav-tab-calendar')).toBeVisible();
    await expect(page.getByTestId('nav-tab-library')).toBeVisible();
    await expect(page.getByTestId('nav-tab-more')).toBeVisible();

    for (let i = 0; i < 4; i++) {
      const box = await tabs.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('each bottom nav tab navigates to its route', async ({ page }) => {
    await page.getByTestId('nav-tab-calendar').tap();
    await expect(page).toHaveURL('/calendar', { timeout: 5000 });
    await page.getByTestId('nav-tab-library').tap();
    await expect(page).toHaveURL('/library', { timeout: 5000 });
    await page.getByTestId('nav-tab-more').tap();
    await expect(page).toHaveURL('/more', { timeout: 5000 });
    await page.getByTestId('nav-tab-home').tap();
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });
});
