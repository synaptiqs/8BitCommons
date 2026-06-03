/**
 * Landing page email-capture modal tests
 * Serves index.html from the project root at port 5501 during the test run.
 *
 * Run with:
 *   npx playwright test tests/landing-modal.spec.ts --config=playwright.landing.config.ts
 */
import { test, expect } from '@playwright/test';

test.describe('Email capture modal', () => {

  test('modal does not exist before any button is clicked', async ({ page }) => {
    await page.goto('/');
    const overlay = page.locator('#fs-early-access-overlay');
    await expect(overlay).toHaveCount(0);
  });

  test('clicking nav "Browse the Directory" button opens the modal', async ({ page }) => {
    await page.goto('/');
    // Nav button (first data-directory-link)
    const btn = page.locator('[data-directory-link]').first();
    await btn.click();

    const overlay = page.locator('#fs-early-access-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('#fs-modal-email')).toBeVisible();
    await expect(overlay.locator('#fs-modal-submit')).toBeVisible();
  });

  test('clicking hero "Open the Directory" button opens the modal', async ({ page }) => {
    await page.goto('/');
    // Second data-directory-link is the hero CTA
    const btn = page.locator('[data-directory-link]').nth(1);
    await btn.click();

    const overlay = page.locator('#fs-early-access-overlay');
    await expect(overlay).toBeVisible();
  });

  test('clicking CTA "Open the Directory" button opens the modal', async ({ page }) => {
    await page.goto('/');
    // Third data-directory-link is the final CTA
    const btn = page.locator('[data-directory-link]').nth(2);
    await btn.click();

    const overlay = page.locator('#fs-early-access-overlay');
    await expect(overlay).toBeVisible();
  });

  test('submitting an empty email shows validation error', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-directory-link]').first().click();

    const overlay = page.locator('#fs-early-access-overlay');
    await overlay.locator('#fs-modal-submit').click();

    const error = overlay.locator('#fs-modal-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText('Please enter a valid email address.');
  });

  test('submitting an invalid email (no @) shows validation error', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-directory-link]').first().click();

    const overlay = page.locator('#fs-early-access-overlay');
    await overlay.locator('#fs-modal-email').fill('notanemail');
    await overlay.locator('#fs-modal-submit').click();

    const error = overlay.locator('#fs-modal-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText('Please enter a valid email address.');
  });

  test('submitting an invalid email (no dot in domain) shows validation error', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-directory-link]').first().click();

    const overlay = page.locator('#fs-early-access-overlay');
    await overlay.locator('#fs-modal-email').fill('user@nodot');
    await overlay.locator('#fs-modal-submit').click();

    const error = overlay.locator('#fs-modal-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText('Please enter a valid email address.');
  });

  test('submitting a valid email clears the error and shows success state', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-directory-link]').first().click();

    const overlay = page.locator('#fs-early-access-overlay');

    // Intercept the Cloudflare Worker fetch so it doesn't actually fire
    await page.route('**/flopsourceadvisor.synaptiqs.workers.dev/lead', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    );

    await overlay.locator('#fs-modal-email').fill('test@example.com');
    await overlay.locator('#fs-modal-submit').click();

    // Error div should be gone / hidden
    const error = overlay.locator('#fs-modal-error');
    // The body is replaced — the error element no longer exists
    await expect(error).toHaveCount(0);

    // Success message should appear
    await expect(overlay).toContainText("You're on the list.");
    await expect(overlay).toContainText('test@example.com');

    // A Close/Done button should appear
    const doneBtn = overlay.locator('#fs-modal-done');
    await expect(doneBtn).toBeVisible();
  });

  test('pressing Enter in the email field submits the form', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-directory-link]').first().click();

    const overlay = page.locator('#fs-early-access-overlay');

    await page.route('**/flopsourceadvisor.synaptiqs.workers.dev/lead', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    );

    await overlay.locator('#fs-modal-email').fill('enter@example.com');
    await overlay.locator('#fs-modal-email').press('Enter');

    await expect(overlay).toContainText("You're on the list.");
  });

  test('clicking the X button closes the modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-directory-link]').first().click();

    const overlay = page.locator('#fs-early-access-overlay');
    await expect(overlay).toBeVisible();

    await overlay.locator('#fs-modal-close').click();
    await expect(overlay).toHaveCount(0);
  });

  test('clicking the backdrop (outside modal card) closes the modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-directory-link]').first().click();

    const overlay = page.locator('#fs-early-access-overlay');
    await expect(overlay).toBeVisible();

    // Click the overlay itself (top-left corner, outside the card)
    await overlay.click({ position: { x: 10, y: 10 } });
    await expect(overlay).toHaveCount(0);
  });

  test('pressing Escape closes the modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-directory-link]').first().click();

    const overlay = page.locator('#fs-early-access-overlay');
    await expect(overlay).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(overlay).toHaveCount(0);
  });

  test('clicking Done button in success state closes the modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-directory-link]').first().click();

    const overlay = page.locator('#fs-early-access-overlay');

    await page.route('**/flopsourceadvisor.synaptiqs.workers.dev/lead', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    );

    await overlay.locator('#fs-modal-email').fill('done@example.com');
    await overlay.locator('#fs-modal-submit').click();

    await expect(overlay).toContainText("You're on the list.");
    await overlay.locator('#fs-modal-done').click();
    await expect(overlay).toHaveCount(0);
  });

  test('DIRECTORY_LIVE=false: buttons have no href (do not navigate away)', async ({ page }) => {
    await page.goto('/');
    const buttons = page.locator('[data-directory-link]');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const href = await buttons.nth(i).getAttribute('href');
      // When DIRECTORY_LIVE is false, href is removed by the script
      expect(href).toBeNull();
    }
  });

});
