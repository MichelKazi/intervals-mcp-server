import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Given the dashboard is loaded fresh
    await page.goto('/');
    // Wait for the skeleton to clear and real content to appear
    await page.waitForSelector('[aria-label*="Next workout"]', { timeout: 10000 });
  });

  test('shows the Next Workout hero with a real workout name', async ({ page }) => {
    // When the dashboard loads
    // Then the hero title is non-blank and not literally "undefined"
    const hero = page.locator('[aria-label*="Next workout"]');
    await expect(hero).toBeVisible();

    const h2 = hero.locator('h2').first();
    const name = await h2.textContent();
    expect(name).toBeTruthy();
    expect(name).not.toBe('undefined');
    expect(name!.trim().length).toBeGreaterThan(0);
  });

  test('hero metadata does not contain "undefined", "NaN", or "Invalid Date"', async ({ page }) => {
    // When the hero card renders
    const hero = page.locator('[aria-label*="Next workout"]');
    const heroText = await hero.textContent();
    expect(heroText).not.toContain('undefined');
    expect(heroText).not.toContain('NaN');
    expect(heroText).not.toContain('Invalid Date');
  });

  test('hero renders WorkoutChart bars (workout-bar elements present)', async ({ page }) => {
    // When the hero card has a workout with steps
    const bars = page.locator('[data-testid="workout-bar"]');
    // Then at least one bar is rendered inside the hero preview
    const count = await bars.count();
    expect(count).toBeGreaterThan(0);
  });

  test('readiness badge shows a verdict word and reasoning text', async ({ page }) => {
    // When the readiness section renders
    const readiness = page.locator('[aria-label="Readiness"]');
    await expect(readiness).toBeVisible({ timeout: 10000 });

    // Then it shows one of the known verdict labels
    const text = await readiness.textContent();
    const hasVerdict = ['Ready', 'Moderate', 'Rest'].some(v => text!.includes(v));
    expect(hasVerdict).toBe(true);

    // And a reasoning text (more than just the verdict word)
    expect(text!.trim().length).toBeGreaterThan(5);
  });

  test('tapping the hero navigates to /workout/:id and loads the detail screen', async ({ page }) => {
    // When the user taps the next-workout hero card
    const hero = page.locator('[aria-label*="Next workout"]');
    await hero.tap();

    // Then the URL changes to /workout/:id
    await expect(page).toHaveURL(/\/workout\/\d+/, { timeout: 8000 });

    // And the detail screen loads (title is not "Could not load workout")
    const h1 = page.locator('header h1');
    await expect(h1).toBeVisible({ timeout: 8000 });
    const title = await h1.textContent();
    expect(title).not.toContain('Could not load workout');
    expect(title).not.toContain('undefined');
  });

  test('bottom nav has 4 tabs (Home/Calendar/Library/More) each at least 44px tall', async ({ page }) => {
    // When the bottom nav renders
    const nav = page.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    const tabs = nav.locator('a');
    await expect(tabs).toHaveCount(4);

    // And the tabs are the expected ones (Activities removed, More added)
    await expect(page.getByTestId('nav-tab-home')).toBeVisible();
    await expect(page.getByTestId('nav-tab-calendar')).toBeVisible();
    await expect(page.getByTestId('nav-tab-library')).toBeVisible();
    await expect(page.getByTestId('nav-tab-more')).toBeVisible();

    // Then each tab is at least 44px tall (touch target)
    for (let i = 0; i < 4; i++) {
      const box = await tabs.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('each bottom nav tab navigates to its route', async ({ page }) => {
    // Calendar tab
    await page.getByTestId('nav-tab-calendar').tap();
    await expect(page).toHaveURL('/calendar', { timeout: 5000 });

    // Library tab
    await page.getByTestId('nav-tab-library').tap();
    await expect(page).toHaveURL('/library', { timeout: 5000 });

    // More tab
    await page.getByTestId('nav-tab-more').tap();
    await expect(page).toHaveURL('/more', { timeout: 5000 });

    // Home tab
    await page.getByTestId('nav-tab-home').tap();
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });
});
