import { test, expect } from '@playwright/test';

test.describe('FlopSource - Comparison Tool + Theme', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for data to load
    await page.waitForSelector('#results-grid .provider-card', { timeout: 10000 });
  });

  test('logo toggles between light and dark theme', async ({ page }) => {
    const html = page.locator('html');

    // Should start in light (or whatever is saved)
    const initialDark = await html.evaluate(el => el.classList.contains('dark'));

    // Click the logo (theme toggle)
    await page.locator('#theme-toggle').click();

    // Theme should have flipped
    const afterClick = await html.evaluate(el => el.classList.contains('dark'));
    expect(afterClick).not.toBe(initialDark);

    // Click again - should flip back
    await page.locator('#theme-toggle').click();
    const afterSecond = await html.evaluate(el => el.classList.contains('dark'));
    expect(afterSecond).toBe(initialDark);
  });

  test('can select providers and open comparison modal', async ({ page }) => {
    // Click "Compare" on the first two cards
    const compareButtons = page.locator('.compare-btn');
    await compareButtons.nth(0).click();
    await compareButtons.nth(1).click();

    // Floating tray should appear
    const tray = page.locator('#comparison-tray');
    await expect(tray).toBeVisible();

    // Click "Compare Providers" inside the tray
    await tray.locator('#tray-compare-btn').click();

    // Full comparison modal should open
    const modal = page.locator('#comparison-modal');
    await expect(modal).toBeVisible();

    // Should see the table
    await expect(modal.locator('table')).toBeVisible();

    // Close it
    await modal.locator('#cmp-close-x').click();
    await expect(modal).not.toBeVisible();
  });

  test('theme toggle works while comparison tray is open', async ({ page }) => {
    // Select two providers
    const compareButtons = page.locator('.compare-btn');
    await compareButtons.nth(0).click();
    await compareButtons.nth(1).click();

    const tray = page.locator('#comparison-tray');
    await expect(tray).toBeVisible();

    // Toggle theme while tray is visible
    await page.locator('#theme-toggle').click();

    // Tray should still be visible and functional after theme change
    await expect(tray).toBeVisible();
    await expect(tray.locator('#tray-compare-btn')).toBeVisible();

    // The "Compare Providers" button should still be clickable
    // (this was the recurring bug we fixed)
    await tray.locator('#tray-compare-btn').click();

    const modal = page.locator('#comparison-modal');
    await expect(modal).toBeVisible();
  });

  test('Ask Grok button exists in comparison modal (dark + light)', async ({ page }) => {
    // Select providers and open modal
    const compareButtons = page.locator('.compare-btn');
    await compareButtons.nth(0).click();
    await compareButtons.nth(1).click();
    await page.locator('#comparison-tray #tray-compare-btn').click();

    const modal = page.locator('#comparison-modal');
    await expect(modal).toBeVisible();

    // "Ask Grok" button should be present in the header
    const aiBtn = modal.locator('#cmp-ai-btn');
    await expect(aiBtn).toBeVisible();

    // Toggle theme
    await page.locator('#theme-toggle').click();

    // Button should still be visible and have correct text after theme change
    await expect(aiBtn).toBeVisible();
    await expect(aiBtn).toContainText(/Ask Grok|Connect Grok/);
  });

});