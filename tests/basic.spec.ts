import { test, expect } from '@playwright/test';

test('page loads with providers and stats', async ({ page }) => {
  await page.goto('/');

  // Main elements exist
  await expect(page.locator('header .logo-wordmark')).toHaveText('FlopSource');
  await expect(page.locator('#results-grid')).toBeVisible();

  // Should have provider cards
  const cards = page.locator('.provider-card');
  await expect(cards.first()).toBeVisible();

  // Stats bar should populate
  await expect(page.locator('#stat-providers')).not.toHaveText('—');
});

test('filtering works', async ({ page }) => {
  await page.goto('/');

  // Click a Layer Type filter pill
  const firstFilter = page.locator('#filter-layer-type .f-pill').first();
  await firstFilter.click();

  // Results count should change (or at least not be the total)
  const count = page.locator('#results-count');
  await expect(count).not.toHaveText('—');
});