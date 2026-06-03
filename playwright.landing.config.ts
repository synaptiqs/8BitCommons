/**
 * Playwright config for landing page (index.html) tests.
 * Serves the project root (not the website/ subfolder) at port 5501.
 *
 * Usage:
 *   npx playwright test tests/landing-modal.spec.ts --config=playwright.landing.config.ts
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/landing-modal.spec.ts'],
  fullyParallel: false,   // serial is fine for modal tests
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-landing', open: 'never' }]],

  use: {
    baseURL: 'http://127.0.0.1:5501',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Serve the project root so index.html is at /
  webServer: {
    command: 'npx http-server . -p 5501 -c-1 --silent',
    url: 'http://127.0.0.1:5501',
    reuseExistingServer: true,
    timeout: 30 * 1000,
  },
});
