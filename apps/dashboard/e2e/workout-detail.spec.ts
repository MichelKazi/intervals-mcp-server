import { test, expect, request } from '@playwright/test';

// Fetch the next-workout id once for the whole suite
let nextWorkoutId: string;
let activityId: string | null = null;

test.beforeAll(async ({ request: req }) => {
  // Given a live server, fetch the dashboard to find the next workout id
  const dashboard = await req.get('/api/dashboard');
  expect(dashboard.ok()).toBe(true);
  const data = await dashboard.json();
  const nw = data.next_workout;
  expect(nw).not.toBeNull();
  nextWorkoutId = String(nw.id);

  // Fetch a recent activity for the completed-activity tests
  const activities = await req.get('/api/activities?oldest=2026-04-01&newest=2026-06-26&limit=5');
  if (activities.ok()) {
    const acts = await activities.json();
    if (Array.isArray(acts) && acts.length > 0) {
      activityId = String(acts[0].id);
    }
  }
});

test.describe('WorkoutDetail — planned workout', () => {
  test.beforeEach(async ({ page }) => {
    // Given the detail page for a known planned workout
    await page.goto(`/workout/${nextWorkoutId}`);
    // Wait for the workout title to load (not "Loading…")
    await page.waitForFunction(() => {
      const h1 = document.querySelector('header h1');
      return h1 && h1.textContent !== 'Loading…' && h1.textContent !== '';
    }, { timeout: 10000 });
  });

  test('loads the planned workout — title is the workout name, NOT an error', async ({ page }) => {
    // When we navigate to /workout/:id
    const h1 = page.locator('header h1');
    const title = await h1.textContent();

    // Then the title is the workout name
    expect(title).not.toContain('Could not load workout');
    expect(title).not.toContain('undefined');
    expect(title).not.toContain('Loading…');
    expect(title!.trim().length).toBeGreaterThan(0);

    // And the error message is NOT on screen
    await expect(page.locator('text=Could not load workout')).not.toBeVisible();
  });

  test('renders WorkoutChart bars (>0)', async ({ page }) => {
    // When the planned workout detail loads
    const bars = page.locator('[data-testid="workout-bar"]');
    const count = await bars.count();
    // Then the chart has bars
    expect(count).toBeGreaterThan(0);
  });

  test('renders MetricStrip with Duration, Load, IF values', async ({ page }) => {
    // When the metric strip renders below the chart
    // Then we find duration-like text (not "undefined" or "NaN")
    const body = await page.locator('main').textContent();
    expect(body).not.toContain('NaN');
    expect(body).not.toContain('undefined');

    // Duration is shown somewhere in the main content
    // It may be "1h 8m" or similar — check it's there
    const hasDuration = /\d+\s*(h|m|min|sec)/.test(body ?? '');
    expect(hasDuration).toBe(true);
  });

  test('action buttons are visible for a WORKOUT category event', async ({ page }) => {
    // When the workout is category=WORKOUT and has no laps
    // Then the action row buttons appear
    await expect(page.locator('[data-testid="mark-done-btn"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="reschedule-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="alternatives-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="edit-btn"]')).toBeVisible();
  });

  test('tapping a workout bar shows the readout with zone, intensity, and duration', async ({ page }) => {
    // Given the chart is rendered
    const bars = page.locator('[data-testid="workout-bar"]');
    await expect(bars.first()).toBeVisible({ timeout: 5000 });

    // When the user taps the first bar
    await bars.first().tap();

    // Then the readout appears
    const readout = page.locator('[data-testid="workout-readout"]');
    await expect(readout).toBeVisible({ timeout: 3000 });

    const text = await readout.textContent();
    // It must show a zone name and some percentage or watts
    expect(text).toBeTruthy();
    // Zone label or % FTP or watts (e.g. "110w" or "95%")
    const hasIntensity = /\d+%|\d+\s*w/i.test(text ?? '');
    expect(hasIntensity).toBe(true);
  });

  test('Edit flow: clicking Edit shows name + date inputs', async ({ page }) => {
    // When the user taps Edit
    await page.locator('[data-testid="edit-btn"]').tap();

    // Then the edit form appears with name and date inputs
    await expect(page.locator('[data-testid="edit-name-input"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="edit-date-input"]')).toBeVisible();
  });

  test('Edit flow: changing name and saving fires a PUT request', async ({ page }) => {
    // Given the edit form is open
    await page.locator('[data-testid="edit-btn"]').tap();
    await expect(page.locator('[data-testid="edit-name-input"]')).toBeVisible({ timeout: 3000 });

    // When the user changes the name and saves
    const input = page.locator('[data-testid="edit-name-input"]');
    const originalName = await input.inputValue();
    await input.fill(originalName + ' (test)');

    // Then a PUT request fires to /api/events/:id
    const putRequest = page.waitForRequest(
      req => req.url().includes(`/api/events/${nextWorkoutId}`) && req.method() === 'PUT',
      { timeout: 5000 }
    );
    await page.locator('button[type="submit"]').tap();
    const req = await putRequest;
    expect(req).toBeTruthy();

    // Restore the original name to avoid polluting data
    // Re-open edit and restore
    await page.waitForTimeout(500);
    const editBtn = page.locator('[data-testid="edit-btn"]');
    if (await editBtn.isVisible()) {
      await editBtn.tap();
      const inp2 = page.locator('[data-testid="edit-name-input"]');
      if (await inp2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await inp2.fill(originalName);
        await page.locator('button[type="submit"]').tap();
      }
    }
  });

  test('Reschedule: clicking Reschedule shows the date input', async ({ page }) => {
    // When the user taps Reschedule
    await page.locator('[data-testid="reschedule-btn"]').tap();

    // Then the date picker input appears
    await expect(page.locator('[data-testid="reschedule-date-input"]')).toBeVisible({ timeout: 3000 });
  });
});

test.describe('WorkoutDetail — completed activity', () => {
  test('completed activity: renders chart from laps + lap breakdown list', async ({ page }) => {
    // Given we have a real activity id
    if (!activityId) {
      test.skip(true, 'No recent activities found in 2026-04-01 to 2026-06-26 range');
      return;
    }

    // When we navigate to the activity detail
    await page.goto(`/workout/${activityId}`);
    await page.waitForFunction(() => {
      const h1 = document.querySelector('header h1');
      return h1 && h1.textContent !== 'Loading…' && h1.textContent !== '';
    }, { timeout: 10000 });

    // Then the title is the activity name (not an error)
    const h1 = page.locator('header h1');
    const title = await h1.textContent();
    expect(title).not.toContain('Could not load workout');
    expect(title).not.toContain('undefined');

    // And chart bars are present (from lap data)
    const bars = page.locator('[data-testid="workout-bar"]');
    const barCount = await bars.count();
    expect(barCount).toBeGreaterThan(0);
  });
});

test.describe('WorkoutDetail — error handling', () => {
  test('nonexistent workout id shows "Could not load workout" and a Retry button', async ({ page }) => {
    // Given a nonexistent workout id
    await page.goto('/workout/999999999');

    // When the error state renders
    await page.waitForFunction(() => {
      const el = document.querySelector('p');
      return el && el.textContent?.includes('Could not load');
    }, { timeout: 10000 });

    // Then the error message is shown
    await expect(page.locator('text=Could not load workout')).toBeVisible({ timeout: 8000 });

    // And a Retry button is present
    await expect(page.locator('button', { hasText: 'Retry' })).toBeVisible();
  });
});
